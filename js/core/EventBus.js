/**
 * EventBus - Simple publish-subscribe pattern for module communication
 * Decouples modules so they don't need direct references to each other
 */
export class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name (format: 'feature:action')
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }

        this.events[event].push(callback);

        // Return unsubscribe function
        return () => {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Data to pass to handlers
     */
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    off(event) {
        delete this.events[event];
    }

    /**
     * Remove all event listeners
     */
    clear() {
        this.events = {};
    }
}

// Create singleton instance
export const eventBus = new EventBus();
