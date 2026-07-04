export interface AgentProgressEvent {
  message: string;
  type: 'progress';
}

export interface AgentChangeEvent {
  entity: 'accommodation' | 'activity' | 'stop' | 'trip' | 'waypoint';
  id: string;
  name: string;
  op: 'created' | 'deleted' | 'updated';
  type: 'change';
}

export interface AgentResultEvent {
  answer: string | null;
  summary: string;
  tripId: string | null;
  type: 'result';
}

export interface AgentErrorEvent {
  detail: string | null;
  message: string;
  type: 'error';
}

export type AgentEvent = AgentChangeEvent | AgentErrorEvent | AgentProgressEvent | AgentResultEvent;

export interface AgentRequestBody {
  prompt: string;
  tripId?: string;
}

export interface AgentBufferedResult {
  answer: string | null;
  changes: AgentChangeEvent[];
  errors: AgentErrorEvent[];
  summary: string;
  tripId: string | null;
}
