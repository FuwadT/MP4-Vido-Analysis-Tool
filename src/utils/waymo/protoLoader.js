import * as protobuf from 'protobufjs';

const E2E_PROTO_PATH = '/waymo-protos/waymo_open_dataset/protos/end_to_end_driving_data.proto';

let e2eTypePromise = null;

function createWaymoRoot() {
    const root = new protobuf.Root();

    root.resolvePath = (_origin, target) => {
        if (target.startsWith('/')) {
            return target;
        }

        return `/waymo-protos/${target}`;
    };

    return root;
}

export async function loadWaymoE2EDFrameType() {
    if (!e2eTypePromise) {
        e2eTypePromise = (async () => {
            const root = createWaymoRoot();
            await root.load(E2E_PROTO_PATH);
            root.resolveAll();
            return root.lookupType('waymo.open_dataset.E2EDFrame');
        })();
    }

    return e2eTypePromise;
}
