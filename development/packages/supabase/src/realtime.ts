import { supabase } from './index';

export class RealtimeManager {
  private channels: Map<string, any> = new Map();

  // Subscribe to a table
  subscribeToTable(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: any) => void
  ) {
    const channelName = `${table}_${event}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName).unsubscribe();
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes' as any, 
        { 
          event, 
          schema: 'public', 
          table 
        }, 
        callback
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to a specific row
  subscribeToRow(
    table: string,
    filter: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: any) => void
  ) {
    const channelName = `${table}_${filter}_${event}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName).unsubscribe();
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes' as any, 
        { 
          event, 
          schema: 'public', 
          table,
          filter 
        }, 
        callback
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Unsubscribe from a channel
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }
}

export const realtimeManager = new RealtimeManager();
