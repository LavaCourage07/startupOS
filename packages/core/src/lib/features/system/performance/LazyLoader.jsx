/**
 * OS.8: Lazy Loader
 */
import { lazy, Suspense } from 'react';
export function lazyLoad(factory, fallback) {
    const Component = lazy(factory);
    return (props) => (<Suspense fallback={fallback || <div>Loading...</div>}>
      <Component {...props}/>
    </Suspense>);
}
