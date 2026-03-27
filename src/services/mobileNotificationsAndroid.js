export class AndroidMobileNotifications {
  constructor(plugin) {
    this.plugin = plugin;
  }

  static supports(platform) {
    return platform === 'android';
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
    if (!this.plugin?.checkExactNotificationSetting) {
      return 'granted';
    }

    try {
      const permission = await this.plugin.checkExactNotificationSetting();
      return permission.exact_alarm;
    } catch {
      return 'prompt';
    }
  }

  async requestExactAlarmPermission() {
    if (!this.plugin?.changeExactNotificationSetting) {
      return 'granted';
    }

    try {
      const permission = await this.plugin.changeExactNotificationSetting();
      return permission.exact_alarm;
    } catch {
      return 'prompt';
    }
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
          schedule: {
            at,
            allowWhileIdle: true,
          },
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
