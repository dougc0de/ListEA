import { TaskAssistantContext } from './context';

export class TaskAssistantOrchestrator {
  constructor({ agents = [] } = {}) {
    this.agents = Array.isArray(agents) ? agents : [];
  }

  async run(input = {}) {
    const context = input instanceof TaskAssistantContext
      ? input
      : new TaskAssistantContext(input);

    for (const agent of this.agents) {
      if (!agent?.canHandle?.(context)) continue;
      await agent.execute(context);
    }

    return context;
  }
}
