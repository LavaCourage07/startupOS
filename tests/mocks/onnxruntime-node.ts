export class InferenceSession {
	static async create(): Promise<InferenceSession> {
		return new InferenceSession();
	}

	async run(): Promise<Record<string, { data: Float32Array; dims: number[] }>> {
		return {};
	}
}

export class Tensor {
	constructor(
		public readonly type: string,
		public readonly data: BigInt64Array | Float32Array,
		public readonly dims: number[],
	) {}
}
