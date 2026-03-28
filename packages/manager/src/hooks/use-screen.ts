import { useState, useCallback } from 'react';

export type Screen =
  | 'dashboard'
  | 'install'
  | 'search'
  | 'my-models'
  | 'model-config'
  | 'model-launch'
  | 'settings'
  | 'service';

export interface ScreenParams {
  modelFile?: string;
  configName?: string;
}

interface ScreenState {
  screen: Screen;
  params: ScreenParams;
  history: Array<{ screen: Screen; params: ScreenParams }>;
}

export function useScreen(initial: Screen = 'dashboard') {
  const [state, setState] = useState<ScreenState>({
    screen: initial,
    params: {},
    history: [],
  });

  const navigate = useCallback((screen: Screen, params: ScreenParams = {}) => {
    setState((prev) => ({
      screen,
      params,
      history: [...prev.history, { screen: prev.screen, params: prev.params }],
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      const history = [...prev.history];
      const last = history.pop();
      if (!last) {
        return { screen: 'dashboard', params: {}, history: [] };
      }
      return { screen: last.screen, params: last.params, history };
    });
  }, []);

  return {
    screen: state.screen,
    params: state.params,
    navigate,
    goBack,
  };
}
