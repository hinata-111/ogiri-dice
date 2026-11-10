/** Cloudflare binding-backed limits; counters are shared within a Cloudflare location. */
export class RateLimiter {
  private binding: RateLimit | undefined;

  constructor(binding?: RateLimit) {
    this.binding = binding;
  }

  async allow(key: string): Promise<boolean> {
    if (!this.binding) throw new Error('Rate limit binding is missing');
    return (await this.binding.limit({ key })).success === true;
  }
}
