<x-app-layout>
    <div class="container" style="max-width: 800px; padding-top: 4rem; padding-bottom: 4rem;">
        <article>
            <header style="text-align: center; margin-bottom: 3rem;">
                <h1 style="font-size: 2.5rem; font-weight: 800; color: #111827; margin-bottom: 1rem; line-height: 1.2;">{{ $post->title }}</h1>
                <div style="color: #6B7280; font-size: 0.95rem;">
                    <span>{{ $post->published_at ? $post->published_at->format('F d, Y') : $post->created_at->format('F d, Y') }}</span>
                    <span style="margin: 0 0.5rem;">&bull;</span>
                    <span>{{ $post->views }} views</span>
                </div>
            </header>

            @if($post->featured_image_url)
                <div style="margin-bottom: 3rem; border-radius: 1rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <img src="{{ $post->featured_image_url }}" alt="{{ $post->title }}" style="width: 100%; height: auto; display: block;">
                </div>
            @endif

            <div class="prose" style="font-size: 1.125rem; color: #374151; line-height: 1.8;">
                {!! $post->content !!}
            </div>
            
            <div style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #E5E7EB; text-align: center;">
                <a href="{{ route('blog.index') }}" class="btn btn-link" style="color: #4F46E5; font-weight: 600;">&larr; Back to Blog</a>
            </div>
        </article>
    </div>
</x-app-layout>
