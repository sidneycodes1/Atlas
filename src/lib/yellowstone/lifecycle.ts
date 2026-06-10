export interface LifecycleRecord {
  signature: string;
  submittedAt: number;
  processedAt?: number;
  confirmedAt?: number;
  finalizedAt?: number;
  failedAt?: number;
  stalledAt?: number;
  latencies: {
    processed?: number;
    confirmed?: number;
    finalized?: number;
    total?: number;
  };
  error?: string;
}

export class LifecycleTracker {
  private records: Map<string, LifecycleRecord> = new Map();

  createRecord(signature: string): LifecycleRecord {
    const record: LifecycleRecord = {
      signature,
      submittedAt: Date.now(),
      latencies: {},
    };
    this.records.set(signature, record);
    return record;
  }

  updateStage(
    signature: string,
    stage: "processed" | "confirmed" | "finalized" | "failed",
    error?: string
  ): LifecycleRecord | undefined {
    const record = this.records.get(signature);
    if (!record) return undefined;

    const now = Date.now();
    if (stage === "processed") {
      record.processedAt = now;
      record.latencies.processed = now - record.submittedAt;
    } else if (stage === "confirmed") {
      record.confirmedAt = now;
      record.latencies.confirmed = record.processedAt ? now - record.processedAt : undefined;
    } else if (stage === "finalized") {
      record.finalizedAt = now;
      record.latencies.finalized = record.confirmedAt ? now - record.confirmedAt : undefined;
      record.latencies.total = now - record.submittedAt;
    } else if (stage === "failed") {
      record.failedAt = now;
      record.latencies.total = now - record.submittedAt;
      record.error = error;
    }

    return record;
  }

  markStalled(signature: string): LifecycleRecord | undefined {
    const record = this.records.get(signature);
    if (!record) return undefined;
    record.stalledAt = Date.now();
    return record;
  }

  getRecord(signature: string): LifecycleRecord | undefined {
    return this.records.get(signature);
  }
}

export const globalLifecycleTracker = new LifecycleTracker();
