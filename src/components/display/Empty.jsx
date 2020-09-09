
import React from 'react';

import './Empty.css';

function EmptyState(props) {
  return (
    <div className={`EmptyState ${props.variant ? `App--theme-${props.variant}` : ''}`}>
      <div className="box">
        <h1>{props.title}</h1>
        <h2 className="message">{props.message}</h2>
      </div>
    </div>
  );
}

export default EmptyState;
