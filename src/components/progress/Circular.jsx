
import React from 'react';

import CircularIcon from './Circular.svg';

import './Circular.css';

function CircularProgress(props) {
  return (
    <CircularIcon width={props.size || 32} height={props.size || 32} className="CircularProgressIcon" />
  );
}

export default CircularProgress;
