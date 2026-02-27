import { Command } from 'commander';
import { getSmithStatus } from '../../runtime/heartbeat';

const statusCommand = new Command('status')
  .description('Retrieve and display the current status of the SMITH agent')
  .action(async () => {
    try {
      const status = await getSmithStatus();
      console.log('SMITH Agent Status:');
      console.log(`Connection State: ${status.connectionState}`);
      console.log(`Active Tasks: ${status.activeTasks.length}`);
      if (status.activeTasks.length > 0) {
        console.log('Active Tasks Details:');
        status.activeTasks.forEach(task => {
          console.log(`- Task ID: ${task.id}, Description: ${task.description}`);
        });
      } else {
        console.log('No active tasks.');
      }
    } catch (error) {
      console.error('Error retrieving status:', error);
    }
  });

export default statusCommand;