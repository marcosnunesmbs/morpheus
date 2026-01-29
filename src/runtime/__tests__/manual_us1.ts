import { Agent } from '../agent.js';
import { MorpheusConfig, DEFAULT_CONFIG } from '../../types/config.js';

// Verify environment requirements
if (!process.env.OPENAI_API_KEY) {
  console.error("Skipping manual test: OPENAI_API_KEY not found in environment");
  process.exit(0);
}

const manualConfig: MorpheusConfig = {
  ...DEFAULT_CONFIG,
  llm: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    api_key: process.env.OPENAI_API_KEY
  }
};

async function run() {
  console.log("Initializing Agent...");
  const agent = new Agent(manualConfig);
  await agent.initialize();

  console.log("Sending message: 'Hello, are you there?'");
  try {
    const response = await agent.chat("Hello, are you there?");
    console.log("Response received:");
    console.log("---------------------------------------------------");
    console.log(response);
    console.log("---------------------------------------------------");
  } catch (error) {
    console.error("Chat failed:", error);
  }
}

run();
