import React, { ReactElement } from 'react';

import './ProgressLoadingBar.css';

export type ProgressLoadingBarProps = {
  progress?: number;
  progressByDOM?: boolean;
};
/**
 * A React component that renders a loading progress bar.
 * If progress is not provided, it will render an infinite loading bar
 * If progress is provided, it will render a progress bar
 * The progress text can be optionally displayed to the left of the bar.
 */
function ProgressLoadingBar({ progress, progressByDOM }: ProgressLoadingBarProps): ReactElement {
  return (
    <div className="loading">
      {(progress === undefined || progress === null) && progressByDOM === null ? (
        <div className="infinite-loading-bar bg-primary-light"></div>
      ) : (
        <div
          id="progress"
          className="bg-primary-light"
          style={{
            width: `${progress || 0}%`,
            height: '8px',
          }}
        ></div>
      )}
    </div>
  );
}

export default ProgressLoadingBar;
