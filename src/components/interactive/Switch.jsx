
import React from 'react';

import './Switch.css';

class Switch extends React.Component {
  
  constructor(props) {
    super(props);
    
    this.state = {checked: props.checked};

    // This binding is necessary to make `this` work in the callback
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    this.setState(state => ({
      checked: !state.checked
    }));

    if('onChange' in this.props) {
      this.props.onChange(!this.state.checked, this);
    }
  }

  render() {
    return (
      <span className={`Switch ${this.props.checked ? 'Switch--checked' : ''}`} onClick={this.handleClick}>
        <span className="Switch__label">{this.props.label}</span>
        <span className="Switch__element"></span>
      </span>
    );
  }
}

export default Switch;
