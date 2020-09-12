
import React from 'react';

import CircularIcon from './Circular.svg';

import './Circular.css';

// # `CircularProgress`
//
// Displays a circular progress indicator.
// Set the `angle` property to set the exact angle in degrees,
// or the `step` property to an integer (and `stepSize` to the angular factor for `step`.)
// `size` is the size, in pixels (default 32); this is the size of the element, as a whole.
function CircularProgress(props) {
  let visible = props.visible === undefined ? true : props.visible;
  
  let angle = props.angle === undefined ? null : props.angle;
  let size = props.size || 32;

  if(props.step) {
    angle = props.step * (props.stepSize || (90 / 4));
  }

  let rotate = {};

  if(angle) {
    rotate = {
      transform: `rotate(${angle % 360}deg)`,
    };
  }

  return (
    <div
      className={`CircularProgress ${angle ? '' : 'CircularProgress--spinning'} ${visible ? '' : 'CircularProgress--hidden'}`}
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
