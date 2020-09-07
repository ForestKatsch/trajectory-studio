
import React from 'react';

import styles from './Empty.module.css';

function EmptyState(props) {
  let variantStyle = '';

  switch(props.variant) {
  case 'dark':
    variantStyle = styles.variantDark;
    break;
  }
  
  return (
    <div className={styles.emptyState + ' ' + variantStyle}>
      <div className={styles.box}>
        <h1>{props.title}</h1>
        <h2 className="message">{props.message}</h2>
      </div>
    </div>
  );
}

export default EmptyState;
