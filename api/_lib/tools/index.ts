export { type AgentTool, dispatchTool, type ToolExecution, toAnthropicTools } from './core.js';
export { READ_TOOLS } from './read.js';

import type { AgentTool } from './core.js';
import { READ_TOOLS } from './read.js';

// Full registry passed to the loop. Write tools are appended by M2 Tasks 2-4.
export const AGENT_TOOLS: AgentTool[] = [...READ_TOOLS];
