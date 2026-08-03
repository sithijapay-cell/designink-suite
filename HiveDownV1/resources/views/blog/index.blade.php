<x-app-layout>
    <div class="container">
        <div class="hero-section" style="padding: 4rem 0 2rem;">
            <h1>Our Blog</h1>
            <p>Latest news, updates, and guides from our team.</p>
        </div>

        <div class="blog-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 4rem;">
            @forelse($posts as $post)
                <div class="card blog-card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
                    @if($post->featured_image_url)
                        <img src="{{ $post->featured_image_url }}" alt="{{ $post->title }}" style="width: 100%; height: 200px; object-fit: cover;">
                    @endif
                    <div class="card-body" style="padding: 1.5rem; flex: 1; display: flex; flex-direction: column;">
                        <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">
                            <a href="{{ route('blog.show', $post->slug) }}" style="color: inherit; text-decoration: none;">{{ $post->title }}</a>
                        </h2>
                        <p style="color: #6B7280; font-size: 0.875rem; margin-bottom: 1rem;">
                            {{ $post->published_at ? $post->published_at->format('M d, Y') : $post->created_at->format('M d, Y') }}
                        </p>
                        <p style="color: #4B5563; margin-bottom: 1.5rem; flex: 1;">
                            {{ Str::limit($post->excerpt ?? strip_tags($post->content), 100) }}
                        </p>
                        <a href="{{ route('blog.show', $post->slug) }}" class="btn btn-link" style="padding: 0; color: #4F46E5; font-weight: 600;">Read More &rarr;</a>
                    </div>
                </div>
            @empty
                <div class="col-span-full text-center" style="grid-column: 1 / -1; padding: 4rem 0;">
                    <p style="color: #6B7280; font-size: 1.125rem;">No posts found.</p>
                </div>
            @endforelse
        </div>

        {{ $posts->links() }}
    </div>
</x-app-layout>
