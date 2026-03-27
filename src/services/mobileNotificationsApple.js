export class AppleMobileNotifications {
  constructor(plugin) {
    this.plugin = plugin;
  }

  static supports(platform) {
    return platform === 'ios';
  }

  async getPermission() {
    const permission = await this.plugin.checkPermissions();
    return permission.display;
  }

  async requestPermission() {
    const permission = await this.plugin.requestPermissions();
    return permission.display;
  }

  async getExactAlarmPermission() {
    return 'granted';
  }

  async requestExactAlarmPermission() {
    return 'granted';
  }

  async schedule({ id, title, body, at }) {
    await this.plugin.cancel({
      notifications: [{ id }],
    });

    await this.plugin.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at },
          sound: undefined,
        },
      ],
    });
  }

  async cancel(id) {
    await this.plugin.cancel({
      notifications: [{ id }],
    });
  }
}
