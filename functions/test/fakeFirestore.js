// 시험용 가짜 Firestore (관리자 SDK 중 handlers.js가 쓰는 부분만). 메모리에 저장한다.
// 트랜잭션은 한 번에 하나씩 실행하고(직렬화), 읽기는 쓰기보다 먼저 해야 한다 (실제 관리자 SDK와 같은 제약).
// docs·onWrite: 브라우저 통합 시험에서 학생·교사 앱용 가짜 Firestore와 같은 저장소를 쓰고 변경을 알리기 위해 넘길 수 있다
export function createFakeFirestore({ docs = new Map(), onWrite = () => {} } = {}) {
  let auto = 0;
  let queue = Promise.resolve();

  const snap = (path) => ({
    id: path.split('/').pop(),
    ref: docRef(path),
    exists: docs.has(path),
    data: () => (docs.has(path) ? { ...docs.get(path) } : undefined),
  });

  function docRef(path) {
    return {
      path,
      id: path.split('/').pop(),
      async get() { return snap(path); },
      async set(data) { docs.set(path, { ...data }); onWrite(); },
    };
  }

  function query(colPath, filters) {
    return {
      colPath,
      where(field, op, value) {
        if (op !== '==') throw new Error('fake supports == only');
        return query(colPath, [...filters, [field, value]]);
      },
      async get() {
        const prefix = `${colPath}/`;
        const list = [...docs.keys()]
          .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
          .filter((p) => filters.every(([f, v]) => docs.get(p)[f] === v))
          .map(snap);
        return { docs: list, empty: list.length === 0 };
      },
    };
  }

  function collection(colPath) {
    return { ...query(colPath, []), doc: (id) => docRef(`${colPath}/${id ?? `auto${++auto}`}`) };
  }

  async function runTransaction(fn) {
    const run = async () => {
      const writes = [];
      const tx = {
        async get(target) {
          if (writes.length) throw new Error('reads must come before writes');
          return target.colPath !== undefined ? target.get() : snap(target.path);
        },
        set(ref, data) { writes.push(() => docs.set(ref.path, { ...data })); },
        update(ref, data) {
          writes.push(() => {
            if (!docs.has(ref.path)) throw new Error(`update of missing doc ${ref.path}`);
            docs.set(ref.path, { ...docs.get(ref.path), ...data });
          });
        },
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      if (writes.length) onWrite();
      return result;
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  return {
    docs,
    doc: docRef,
    collection,
    runTransaction,
  };
}

export const ts = (ms) => ({ ms, toMillis() { return ms; } });
