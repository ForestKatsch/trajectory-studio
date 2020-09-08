
import React from 'react';
import Logger from 'js-logger';

import StellarRenderer from './renderer.js';
import EmptyState from '../../display/Empty.jsx';

import Switch from '../../interactive/Switch.jsx';

import './style.css';

// A 3D viewer for stellar bodies and orbits.
class StellarViewer extends React.Component {
  
  constructor(props) {
    super(props);
    
    this.state = {
      display_stats: true,
      display_atmospheres: true,
      login: '',
      errorMessage: null,
      
      stats_fps: 0,
      stats_vertex_count: 0,
      stats_draw_call_count: 0,
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

    this.deinitRenderer();
  }

  handleWindowResize() {
    this.renderer.resize();
  }

  initRenderer() {
    try {
      this.renderer.init();
      this.renderer.viewer = this;
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

  createSwitchHandler(name) {
    return (checked) => {
      this.setState(state => ({
        [name]: checked
      }));
    };
  }

  render() {
    var emptyState = null;

    if(this.state.errorMessage) {
      emptyState = (
        <EmptyState variant="dark" title="Something went wrong" message={this.state.errorMessage}></EmptyState>
      );
    }

    if(this.renderer) {
      this.renderer.setOption('display_atmospheres', this.state.display_atmospheres);
    }
    
    return (
      <section className={`StellarViewer ${this.state.display_stats ? 'StellarViewer--stats-visible' : ''}`}>
        <canvas ref={this.canvas}></canvas>
        {emptyState}
        <div className="StellarViewer__options">
          <Switch label="Orbit Lines"></Switch>
          <Switch label="Spacecraft Trajectories"></Switch>
          <Switch
            label="Planet Atmospheres"
            checked={this.state.display_atmospheres}
            onChange={this.createSwitchHandler('display_atmospheres')}
          />
          <Switch
            label="Show Stats"
            checked={this.state.display_stats}
            onChange={this.createSwitchHandler('display_stats')}
          />
          <ul className={`stats`}>
            <li>{this.state.stats_fps.toFixed(1)} fps</li>
            <li>{this.state.stats_draw_call_count} draw calls</li>
            <li>{this.state.stats_vertex_count} vertices</li>
          </ul>
        </div>
      </section>
    );
  }
}

export default StellarViewer;
