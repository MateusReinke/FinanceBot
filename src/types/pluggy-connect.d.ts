export {};

interface PluggyConnectItemData {
  item: {
    id: string;
    connector?: { name?: string };
  };
}

interface PluggyConnectOptions {
  connectToken: string;
  includeSandbox?: boolean;
  clientUserId?: string;
  updateItem?: string;
  onSuccess?: (itemData: PluggyConnectItemData) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

interface PluggyConnectInstance {
  init: () => void;
}

declare global {
  interface Window {
    PluggyConnect?: new (options: PluggyConnectOptions) => PluggyConnectInstance;
  }
}
