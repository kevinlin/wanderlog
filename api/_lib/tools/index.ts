export { type AgentTool, dispatchTool, type ToolExecution, toAnthropicTools } from './core.js';
export { READ_TOOLS } from './read.js';

import type { AgentTool } from './core.js';
import { ACTIVITY_TOOLS, WAYPOINT_TOOLS } from './items.js';
import { READ_TOOLS } from './read.js';
import { STOP_TOOLS } from './stops.js';
import { TRIP_FIELD_TOOLS } from './tripFields.js';

// The full M2 registry passed to the loop.
export const AGENT_TOOLS: AgentTool[] = [...READ_TOOLS, ...ACTIVITY_TOOLS, ...WAYPOINT_TOOLS, ...TRIP_FIELD_TOOLS, ...STOP_TOOLS];
