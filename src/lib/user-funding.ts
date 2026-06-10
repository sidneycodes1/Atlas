export const fundedUsers = new Map<string, boolean>();

export function hasUserBeenFunded(walletAddress: string): boolean {
  return fundedUsers.has(walletAddress) && fundedUsers.get(walletAddress) === true;
}

export function markUserAsFunded(walletAddress: string): void {
  fundedUsers.set(walletAddress, true);
  // Persist to localStorage
  if (typeof window !== 'undefined') {
    const funded = JSON.parse(localStorage.getItem('atlasFundedUsers') || '[]');
    if (!funded.includes(walletAddress)) {
      funded.push(walletAddress);
      localStorage.setItem('atlasFundedUsers', JSON.stringify(funded));
    }
  }
}

export function loadFundedUsersFromStorage(): void {
  if (typeof window !== 'undefined') {
    const funded = JSON.parse(localStorage.getItem('atlasFundedUsers') || '[]');
    funded.forEach((addr: string) => fundedUsers.set(addr, true));
  }
}

// Load on app start
loadFundedUsersFromStorage();
