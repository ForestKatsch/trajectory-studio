
import React from 'react';

import CircularIcon from './Circular.svg';

import './Circular.css';

function CircularProgress(props) {
  let angle = null;
  let size = props.size || 32;

  if(props.step) {
    angle = props.step * 90 / (props.stepSize || 90 / 4);
  }

  let rotate = {};

  if(angle) {
    rotate = {
      transform: `rotate(${angle % 360}deg)`,
    };
  }

  return (
    <div
      className={`CircularProgress ${angle ? '' : 'CircularProgress--spinning'}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...rotate
      }}
      dangerouslySetInnerHTML={{__html: CircularIcon}}
    >
    </div>
  );
}

export default CircularProgress;
