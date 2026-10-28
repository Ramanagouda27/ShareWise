declare global {
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          url?: string;
          'loading-anim-type'?: string;
          events?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
