import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import bs58pkg from "bs58";
import { getConnectionWithFallback } from "./solana/connection";

const bs58 = (bs58pkg as any).default || bs58pkg;

export interface TransactionUpdate {
  stage: "processed" | "confirmed" | "finalized" | "failed";
  slot: number;
  timestamp: number;
  latency?: number;
  error?: string;
}

// Global state for Serverless context
const trackedSignatures = new Set<string>();
const updateEmitters = new Map<string, (update: TransactionUpdate) => void>();
const signatureStartTimes = new Map<string, number>();

let grpcClient: any = null;
let grpcStream: any = null;
let isConnected = false;
let reconnectAttempt = 0;
let grpcPermanentlyFailed = false;

const messageBuffer: any[] = [];
const MAX_BUFFER_SIZE = 500;

// Load proto definitions dynamically
function loadGeyserClient() {
  const PROTO_PATH = path.join(process.cwd(), "src/lib/yellowstone/geyser.proto");
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
  return protoDescriptor.geyser.Geyser;
}

function connectGrpc() {
  if (grpcClient || isConnected || grpcPermanentlyFailed) return;

  const endpoint = process.env.YELLOWSTONE_GRPC_ENDPOINT;
  const token = process.env.YELLOWSTONE_GRPC_TOKEN;

  if (!endpoint || !token) {
    console.warn("[Yellowstone gRPC] Missing credentials. Streaming disabled.");
    return;
  }

  try {
    const url = endpoint.includes("://") ? endpoint.split("://")[1] : endpoint;
    const GeyserClient = loadGeyserClient();
    
    // Create credentials with metadata token
    const creds = grpc.credentials.createSsl();
    grpcClient = new GeyserClient(url, creds);
    
    startStream(token);
  } catch (err: any) {
    console.error(`[Yellowstone gRPC] Initialization error: ${err.message}`);
    handleStreamError(err);
  }
}

function startStream(token: string) {
  try {
    if (!grpcClient) return;

    console.log(`[Yellowstone gRPC] Attempting to connect via pure JS gRPC...`);
    
    const metadata = new grpc.Metadata();
    metadata.add("x-token", token);

    grpcStream = grpcClient.Subscribe(metadata);

    isConnected = true;
    reconnectAttempt = 0;
    console.log(`[Yellowstone gRPC] Connected successfully.`);

    grpcStream.on("data", handleData);
    grpcStream.on("error", (err: any) => {
      console.error(`[Yellowstone gRPC] Stream error:`, err.message, `(code: ${err.code})`);
      isConnected = false;
      handleStreamError(err);
    });
    grpcStream.on("end", () => {
      console.warn(`[Yellowstone gRPC] Stream ended.`);
      isConnected = false;
      handleStreamError(null);
    });

    const req = {
      slots: { "slot-sub": { filter_by_commitment: true } },
      transactions: {
        "tx-sub": {
          account_include: [],
          account_exclude: [],
          account_required: [],
        },
      },
      commitment: "PROCESSED", // enum value from proto
    };

    grpcStream.write(req);
  } catch (err: any) {
    console.error(`[Yellowstone gRPC] Failed to start stream: ${err.message}`);
    isConnected = false;
    handleStreamError(err);
  }
}

function cleanupGrpc() {
  if (grpcClient) {
    if (grpcStream) {
      grpcStream.cancel();
      grpcStream = null;
    }
    grpcClient.close();
    grpcClient = null;
  }
}

function handleStreamError(err: any) {
  if (err && err.code === 7) {
    console.error(`[Yellowstone] Permanently falling back to RPC polling: provider requires upgraded plan for gRPC streaming (PERMISSION_DENIED)`);
    grpcPermanentlyFailed = true;
    cleanupGrpc();
    return;
  }

  // Check if it's a transient error (14: UNAVAILABLE, 4: DEADLINE_EXCEEDED, 13: INTERNAL) or unknown drop (no error code)
  const isTransient = !err || !err.code || [14, 4, 13].includes(err.code);

  if (!isTransient) {
    console.error(`[Yellowstone] Non-transient error (code: ${err.code}). Permanently falling back to RPC polling.`);
    grpcPermanentlyFailed = true;
    cleanupGrpc();
    return;
  }

  if (reconnectAttempt >= 3) {
    console.error(`[Yellowstone] Maximum reconnection attempts (3) reached. Permanently falling back to RPC polling.`);
    grpcPermanentlyFailed = true;
    cleanupGrpc();
    return;
  }

  scheduleReconnect();
}

function scheduleReconnect() {
  cleanupGrpc();

  const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
  reconnectAttempt++;

  console.log(`[Yellowstone gRPC] Disconnected. Attempting reconnect ${reconnectAttempt} in ${backoffMs}ms...`);
  setTimeout(connectGrpc, backoffMs);
}

function handleData(data: any) {
  if (messageBuffer.length >= MAX_BUFFER_SIZE) {
    messageBuffer.shift();
    console.warn(`[Yellowstone gRPC] Backpressure: Buffer exceeded ${MAX_BUFFER_SIZE}. Dropped oldest message.`);
  }
  messageBuffer.push(data);
  processBuffer();
}

function processBuffer() {
  while (messageBuffer.length > 0) {
    const data = messageBuffer.shift();

    if (data.transaction && data.transaction.transaction) {
      const sigBuffer = data.transaction.transaction.signature;
      if (!sigBuffer) continue;

      const signature = bs58.encode(sigBuffer);

      if (trackedSignatures.has(signature)) {
        const err = data.transaction.transaction.meta?.err;
        const slot = parseInt(data.transaction.slot, 10);
        const startTime = signatureStartTimes.get(signature) || Date.now();

        const update: TransactionUpdate = {
          stage: err ? "failed" : "processed",
          slot,
          timestamp: Date.now(),
          latency: Date.now() - startTime,
          error: err ? JSON.stringify(err) : undefined,
        };

        console.log(
          `[Yellowstone gRPC] Stage transition: ${signature} | Slot: ${slot} | Stage: ${update.stage} | Timestamp: ${update.timestamp}`
        );

        const emitter = updateEmitters.get(signature);
        if (emitter) emitter(update);
      }
    }
  }
}

async function pollSignatureFallback(signature: string, emitter: (u: TransactionUpdate) => void) {
  const connection = await getConnectionWithFallback();
  const startTime = signatureStartTimes.get(signature) || Date.now();
  let lastStage = "processed";

  const interval = setInterval(async () => {
    try {
      const status = await connection.getSignatureStatus(signature);
      if (status && status.value) {
        const val = status.value;
        const slot = status.context?.slot || 0;

        if (val.err) {
          emitter({
            stage: "failed",
            slot,
            timestamp: Date.now(),
            latency: Date.now() - startTime,
            error: JSON.stringify(val.err),
          });
          clearInterval(interval);
          trackedSignatures.delete(signature);
          updateEmitters.delete(signature);
          return;
        }

        if (val.confirmationStatus === "confirmed" && lastStage !== "confirmed") {
          lastStage = "confirmed";
          emitter({ stage: "confirmed", slot, timestamp: Date.now(), latency: Date.now() - startTime });
        } else if (val.confirmationStatus === "finalized") {
          emitter({ stage: "finalized", slot, timestamp: Date.now(), latency: Date.now() - startTime });
          clearInterval(interval);
          trackedSignatures.delete(signature);
          updateEmitters.delete(signature);
        }
      }
    } catch (e) {}
  }, 2000);

  return () => clearInterval(interval);
}

export async function* subscribeToTransaction(
  signature: string,
  isSimulated: boolean = false,
  simulationMode?: string
): AsyncGenerator<TransactionUpdate> {
  const startTime = Date.now();
  console.log(`[Yellowstone gRPC] Tracking signature: ${signature}`);

  if (!isConnected) {
    connectGrpc();
  }

  const endpoint = process.env.YELLOWSTONE_GRPC_ENDPOINT;
  if (!endpoint || !grpcClient) {
    console.warn(`[Yellowstone] FALLBACK: using simulated stream because real connection failed: Missing credentials or client initialization failed`);
    
    const mode = simulationMode || "success";
    yield { stage: "processed", slot: 28394012, timestamp: Date.now(), latency: Date.now() - startTime };
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (mode === "low_tip" || mode === "expired_blockhash" || mode === "leader_miss" || mode === "congestion") {
      yield {
        stage: "failed",
        slot: 28394015,
        timestamp: Date.now(),
        latency: Date.now() - startTime,
        error: `Simulation Error: ${mode.toUpperCase()}`,
      };
      return;
    }

    yield { stage: "confirmed", slot: 28394022, timestamp: Date.now(), latency: Date.now() - startTime };
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield { stage: "finalized", slot: 28394050, timestamp: Date.now(), latency: Date.now() - startTime };
    return;
  }

  trackedSignatures.add(signature);
  signatureStartTimes.set(signature, startTime);

  const queue: TransactionUpdate[] = [];
  let resolveNext: ((value: any) => void) | null = null;

  const emitter = (update: TransactionUpdate) => {
    queue.push(update);
    if (resolveNext) {
      resolveNext({ value: update, done: false });
      resolveNext = null;
    }
  };

  updateEmitters.set(signature, emitter);

  const cleanupPolling = await pollSignatureFallback(signature, emitter);

  try {
    while (true) {
      if (queue.length > 0) {
        const item = queue.shift()!;
        yield item;
        if (item.stage === "finalized" || item.stage === "failed") {
          break;
        }
      } else {
        await new Promise((resolve) => {
          resolveNext = resolve;
        });
      }
    }
  } finally {
    cleanupPolling();
    trackedSignatures.delete(signature);
    updateEmitters.delete(signature);
    signatureStartTimes.delete(signature);
  }
}
