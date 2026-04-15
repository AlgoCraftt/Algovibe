/**
 * AlgoCraft Bridge Protocol
 * 
 * Defines the communication messages between the Sandpack iframe (generated DApp)
 * and the parent AlgoCraft application.
 */

export const ALGOCRAFT_BRIDGE_VERSION = '1.0.0';

export type BridgeMessageType = 
  | 'GET_ADDRESS'      // Request current wallet address
  | 'CALL_METHOD'       // Request an ABI method call
  | 'READ_STATE'        // Request global/local state reading
  | 'OPT_IN'            // Request app opt-in
  | 'GET_NETWORK'       // Request current network info
  | 'SIGN_TRANSACTION'; // Request raw transaction signing

export interface BridgeRequest {
  id: string;          // Unique request ID
  type: BridgeMessageType;
  payload?: any;
}

export interface BridgeResponse {
  id: string;          // Matches the request ID
  type: 'ALGOCRAFT_RESPONSE';
  result?: any;
  error?: string;
}

export interface BridgeEvent {
  type: 'ALGOCRAFT_EVENT';
  event: 'WALLET_CHANGED' | 'NETWORK_CHANGED';
  payload: any;
}

// Helper types for specific payloads
export interface CallMethodPayload {
  method: string;
  args: any[];
  appId: number | string;
  // Optional payment info for atomic groups
  payment?: {
    amount: number; // In microAlgos
    receiver?: string; // Default to App Address if missing
  };
}

export interface ReadStatePayload {
  appId: number | string;
  keys?: string[]; // Optional specific keys
  address?: string; // Optional for local state
}
