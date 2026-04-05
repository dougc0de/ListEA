export class TaskAssistantAgent {
  canHandle() {
    return true;
  }

  async execute(context) {
    return context;
  }
}
