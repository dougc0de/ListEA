export class TaskEntity {
  constructor(task) {
    this.id = task.id;
    this.title = task.title;
    this.notes = task.notes;
    this.done = task.done;
    this.createdAt = task.createdAt;
    this.updatedAt = task.updatedAt;
    this.reminderAt = task.reminderAt;
    this.reminderSent = task.reminderSent;
    this.priority = task.priority;
    this.tags = task.tags;
    this.subtasks = task.subtasks;
    this.templateId = task.templateId;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      notes: this.notes,
      done: this.done,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      reminderAt: this.reminderAt,
      reminderSent: this.reminderSent,
      priority: this.priority,
      tags: [...this.tags],
      subtasks: this.subtasks.map(subtask => ({ ...subtask })),
      templateId: this.templateId,
    };
  }
}

export class TaskFactory {
  create(payload) {
    const now = new Date().toISOString();
    return new TaskEntity({
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: payload.title.trim(),
      notes: (payload.notes ?? '').trim(),
      done: false,
      createdAt: now,
      updatedAt: now,
      reminderAt: payload.reminderAt ?? '',
      reminderSent: false,
      priority: payload.priority ?? 'medium',
      tags: this.normalizeTags(payload.tags),
      subtasks: this.normalizeSubtasks(payload.subtasks),
      templateId: payload.templateId ?? '',
    });
  }

  normalize(rawTask, index = 0) {
    const createdAt = rawTask.createdAt ?? new Date().toISOString();
    const updatedAt = rawTask.updatedAt ?? createdAt;
    return new TaskEntity({
      id: rawTask.id ?? Date.now() + index,
      title: (rawTask.title ?? '').trim(),
      notes: rawTask.notes ?? '',
      done: Boolean(rawTask.done),
      createdAt,
      updatedAt,
      reminderAt: rawTask.reminderAt ?? '',
      reminderSent: Boolean(rawTask.reminderSent),
      priority: rawTask.priority ?? 'medium',
      tags: this.normalizeTags(rawTask.tags),
      subtasks: this.normalizeSubtasks(rawTask.subtasks),
      templateId: rawTask.templateId ?? '',
    });
  }

  normalizeTags(tags = []) {
    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
    }

    return Array.isArray(tags)
      ? tags.map(tag => `${tag}`.trim()).filter(Boolean)
      : [];
  }

  normalizeSubtasks(subtasks = []) {
    if (!Array.isArray(subtasks)) {
      return [];
    }

    return subtasks
      .map((subtask, index) => {
        if (typeof subtask === 'string') {
          return {
            id: `${Date.now()}-${index}`,
            title: subtask.trim(),
            done: false,
          };
        }

        return {
          id: subtask.id ?? `${Date.now()}-${index}`,
          title: `${subtask.title ?? ''}`.trim(),
          done: Boolean(subtask.done),
        };
      })
      .filter(subtask => subtask.title);
  }
}

export class TaskBoardBuilder {
  build(tasks) {
    return {
      high: tasks.filter(task => !task.done && task.priority === 'high'),
      medium: tasks.filter(task => !task.done && task.priority === 'medium'),
      low: tasks.filter(task => !task.done && task.priority === 'low'),
    };
  }
}
