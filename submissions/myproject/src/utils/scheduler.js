import cron from 'node-cron';
import config from '../config.js';
import logger from './logger.js';

class Scheduler {
  constructor() {
    this.tasks = new Map();
  }

  // Schedules a task with a cron expression
  // name - Unique name for the task
  // cronExpression - Cron expression (ex: "0 */4 * * *" for every 4 hours)
  // task - Function to execute
  // runImmediately - If true, executes the task immediately in addition to scheduling
  schedule(name, cronExpression, task, runImmediately = false) {
    if (this.tasks.has(name)) {
      logger.warn(`Task "${name}" already scheduled, it will be replaced`);
      this.tasks.get(name).stop();
    }
    
    logger.info(`Scheduling task "${name}" with cron expression: ${cronExpression}`);
    
    const cronTask = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`Executing scheduled task: ${name}`);
        await task();
        logger.info(`Task "${name}" completed successfully`);
      } catch (error) {
        logger.error(`Error executing task "${name}": ${error.message}`);
      }
    });
    
    this.tasks.set(name, cronTask);
    
    // Immediate execution if requested
    if (runImmediately) {
      logger.info(`Executing task immediately: ${name}`);
      setTimeout(async () => {
        try {
          await task();
          logger.info(`Immediate execution of task "${name}" completed successfully`);
        } catch (error) {
          logger.error(`Error during immediate execution of task "${name}": ${error.message}`);
        }
      }, 0);
    }
    
    return cronTask;
  }

  // Stops a scheduled task
  // name - Name of the task to stop
  stop(name) {
    if (this.tasks.has(name)) {
      logger.info(`Stopping scheduled task: ${name}`);
      this.tasks.get(name).stop();
      this.tasks.delete(name);
      return true;
    }
    
    logger.warn(`Attempt to stop non-existent task: ${name}`);
    return false;
  }

  // Stops all scheduled tasks
  stopAll() {
    logger.info(`Stopping all scheduled tasks (${this.tasks.size} tasks)`);
    
    for (const [name, task] of this.tasks.entries()) {
      logger.info(`Stopping task: ${name}`);
      task.stop();
    }
    
    this.tasks.clear();
  }
}

// Export a singleton instance
export default new Scheduler();