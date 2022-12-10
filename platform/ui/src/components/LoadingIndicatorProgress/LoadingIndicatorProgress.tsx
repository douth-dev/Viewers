import React from 'react';
import classNames from 'classnames';
import { Icon } from '@ohif/ui';

import './LoadingIndicatorProgress.css';

/**
 *  A React component that renders a loading indicator.
 * if progress is not provided, it will render an infinite loading indicator
 * if progress is provided, it will render a progress bar
 * Optionally a textBlock can be provided to display a message
 */
function LoadingIndicatorProgress({
  className,
  textBlock,
  progress,
  progressByDOM,
}) {
  console.log(progressByDOM);
  return (
    <div
      className={classNames(
        'absolute z-50 top-0 left-0 flex flex-col items-center justify-center space-y-5',
        className
      )}
    >
      <Icon name="loading-ohif-mark" className="text-white w-12 h-12" />
      <div className="loading">
        {(progress === undefined || progress === null) &&
        progressByDOM === null ? (
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
      <span style={{ color: 'white' }}>Carregando...</span>
      <span id="progress-text" style={{ color: 'white' }}>
        {textBlock}
      </span>
    </div>
  );
}

export default LoadingIndicatorProgress;
