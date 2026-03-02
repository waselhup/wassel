export default async function handler(req, res) {
    const module = await import('../dist/api/index.js');
    const app = module.default;
    return app(req, res);
}
