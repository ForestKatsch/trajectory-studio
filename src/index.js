import React from 'react';
import ReactDOM from 'react-dom';
//import './index.css';
import App from './App.jsx';
import * as serviceWorker from './serviceWorker';

import Logger from 'js-logger';

Logger.useDefaults();
Logger.setLevel(Logger.TRACE);

var consoleHandler = Logger.createDefaultHandler();
var myHandler = (messages, context) => {
  if(context.level.value > Logger.DEBUG.value) {
	  //alert([...messages].join(', '))
  }
};

Logger.setHandler(function (messages, context) {
	consoleHandler(messages, context);
	myHandler(messages, context);
});


ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('react-root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
