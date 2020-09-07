
import React from 'react';
import Logger from 'js-logger';

import StellarRenderer from './renderer.js';
import EmptyState from '../../display/Empty.jsx';

import style from './style.module.css';

// A 3D viewer for stellar bodies and orbits.
class StellarViewer extends React.Component {
  
  constructor(props) {
    super(props);
    
    this.state = {
      login: '',
      errorMessage: null,
    };

    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.canvas = React.createRef();
    this.renderer = null;
  }

  componentDidMount() {
    this.renderer = new StellarRenderer(this.canvas.current);

    this.initRenderer();

    window.addEventListener('resize', this.handleWindowResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleWindowResize)
    
    this.renderer.deinit();
  }

  handleWindowResize() {
    this.renderer.resize();
  }

  initRenderer() {
    try {
      this.renderer.init();
    } catch(e) {
      Logger.error('Error while creating WebGL context: ', e);
      
      this.setState((state, props) => ({
        errorMessage: `We couldn't initialize WebGL. It could be you; it could be us.'${e.message}'`
      }));

      return;
    }
  }

  deinitRenderer() {
    this.renderer.deinit();
  }

  render() {
    var emptyState = null;

    if(this.state.errorMessage) {
      emptyState = (
        <EmptyState variant="dark" title="Something went wrong" message={this.state.errorMessage}></EmptyState>
      );
    }
    
    return (
      <section className={style.stellarViewer + ' StellarViewer'}>
        <canvas ref={this.canvas}></canvas>
        {emptyState}
      </section>
    );
  }
}

export default StellarViewer;
