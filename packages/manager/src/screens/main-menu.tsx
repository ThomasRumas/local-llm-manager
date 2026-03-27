import { Box, useApp } from 'ink';
import { Header } from '../components/header.js';
import { MenuList, type MenuItem } from '../components/menu-list.js';
import { HelpBar } from '../components/help-bar.js';
import type { Screen } from '../hooks/use-screen.js';

interface MainMenuProps {
  onNavigate: (screen: Screen) => void;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Install / Check llama.cpp',
    value: 'install',
    shortcut: '1',
    description: 'Check status or install llama.cpp via Homebrew',
  },
  {
    label: 'Search Models (Hugging Face)',
    value: 'search',
    shortcut: '2',
    description: 'Search and download GGUF models',
  },
  {
    label: 'My Models',
    value: 'my-models',
    shortcut: '3',
    description: 'View downloaded models',
  },
  {
    label: 'Settings',
    value: 'settings',
    shortcut: '4',
    description: 'Configure models directory and defaults',
  },
  {
    label: 'Quit',
    value: 'quit',
    shortcut: 'q',
    description: 'Exit the application',
  },
];

export function MainMenu({ onNavigate }: MainMenuProps) {
  const { exit } = useApp();

  const handleSelect = (item: MenuItem) => {
    if (item.value === 'quit') {
      exit();
      return;
    }
    onNavigate(item.value as Screen);
  };

  return (
    <Box flexDirection="column">
      <Header />
      <MenuList items={MENU_ITEMS} onSelect={handleSelect} />
      <HelpBar
        items={[
          { key: '↑↓', label: 'navigate' },
          { key: 'Enter', label: 'select' },
          { key: '1-4', label: 'shortcut' },
          { key: 'q', label: 'quit' },
        ]}
      />
    </Box>
  );
}
