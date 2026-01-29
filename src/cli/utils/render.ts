import chalk from 'chalk';
import figlet from 'figlet';

export function renderBanner() {
  const art = figlet.textSync('Morpheus', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });
  console.log(chalk.cyanBright(art));
  console.log(chalk.gray('  The Local-First AI Agent specialized in Coding\n'));
}
