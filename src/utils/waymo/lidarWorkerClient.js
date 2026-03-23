function createDeferred() {
    let resolve;
    let reject;

    const promise = new Promise((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });

    return { promise, resolve, reject };
}

export function createLidarWorkerClient(calibrations) {
    if (typeof Worker === 'undefined') {
        return null;
    }

    let worker;

    try {
        worker = new Worker(new URL('./lidarWorker.js', import.meta.url), { type: 'module' });
    } catch (error) {
        console.warn('Falling back to main-thread LiDAR decoding.', error);
        return null;
    }

    let messageId = 0;
    const pending = new Map();
    const ready = createDeferred();

    worker.onmessage = (event) => {
        const { id, type, payload } = event.data || {};

        if (type === 'ready') {
            ready.resolve();
            return;
        }

        const request = pending.get(id);
        if (!request) {
            return;
        }

        pending.delete(id);

        if (type === 'result') {
            request.resolve(payload);
            return;
        }

        request.reject(new Error(payload?.message || 'LiDAR worker failed.'));
    };

    worker.onerror = (event) => {
        const error = event?.error instanceof Error
            ? event.error
            : new Error(event?.message || 'LiDAR worker failed.');

        if (ready) {
            ready.reject(error);
        }

        for (const request of pending.values()) {
            request.reject(error);
        }

        pending.clear();
    };

    worker.postMessage({
        id: ++messageId,
        type: 'init',
        payload: { calibrations }
    });

    return {
        async buildPointCloud(options) {
            await ready.promise;

            const deferred = createDeferred();
            const id = ++messageId;
            pending.set(id, deferred);

            worker.postMessage({
                id,
                type: 'build',
                payload: options
            });

            return deferred.promise;
        },
        dispose() {
            worker.terminate();
            const error = new Error('LiDAR worker disposed.');

            for (const request of pending.values()) {
                request.reject(error);
            }

            pending.clear();
        }
    };
}
