
import React from 'react';

import styles from './Empty.module.css';

function EmptyState(props) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.box}>
        <h1>{props.title}</h1>
        <h2>{props.message}</h2>
      </div>
    </div>
  );
}

export default EmptyState;
