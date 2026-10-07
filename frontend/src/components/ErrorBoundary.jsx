import React from 'react';
import { OureaLogo } from './OureaLogo.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('OUREA UI error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error">
          <OureaLogo />
          <h1>OUREA could not start.</h1>
          <p>{this.state.error.message}</p>
          <p>Open the browser console for the full diagnostic.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
