<?php

namespace App\Http\Controllers;

use App\Models\BlogPost;
use Illuminate\Http\Request;

class BlogController extends Controller
{
    public function index()
    {
        $posts = BlogPost::where('is_published', true)
            ->orderBy('published_at', 'desc')
            ->paginate(10);

        return view('blog.index', [
            'posts' => $posts,
            'title' => 'Blog - ' . config('app.name'),
            'description' => 'Read our latest news, updates, and guides on video downloading.',
        ]);
    }

    public function show($slug)
    {
        $post = BlogPost::where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();

        $post->incrementViews();

        return view('blog.show', [
            'post' => $post,
            'title' => $post->title,
            'description' => $post->excerpt ?? \Illuminate\Support\Str::limit(strip_tags($post->content), 160),
            'image' => $post->featured_image_url,
        ]);
    }
}
