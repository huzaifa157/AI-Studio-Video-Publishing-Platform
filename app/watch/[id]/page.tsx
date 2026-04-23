"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type VideoItem = {
	_id: string;
	title: string;
	description: string;
	videoUrl: string;
	thumbnailUrl: string;
	createdBy?: string;
	createdAt?: string;
};

const formatDate = (date?: string) => {
	if (!date) {
		return "Unknown date";
	}
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

export default function WatchPage() {
	const params = useParams();
	const videoId = params.id as string;
	const [video, setVideo] = useState<VideoItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchVideo = async () => {
			try {
				const res = await fetch(`/api/video`);
				if (!res.ok) throw new Error("Failed to fetch videos");
				const videos = await res.json();
				const foundVideo = videos.find((v: VideoItem) => v._id === videoId);
				if (!foundVideo) {
					setError("Video not found");
				} else {
					setVideo(foundVideo);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
			} finally {
				setLoading(false);
			}
		};

		void fetchVideo();
	}, [videoId]);

	if (loading) {
		return (
			<main className="min-h-screen bg-gray-950 px-4 py-8">
				<div className="mx-auto max-w-4xl">
					<Link
						href="/"
						className="mb-6 inline-flex items-center gap-2 text-gray-400 transition hover:text-cyan-300"
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back to videos
					</Link>
					<div className="flex items-center justify-center py-32">
						<p className="text-gray-400">Loading video...</p>
					</div>
				</div>
			</main>
		);
	}

	if (error || !video) {
		return (
			<main className="min-h-screen bg-gray-950 px-4 py-8">
				<div className="mx-auto max-w-4xl">
					<Link
						href="/"
						className="mb-6 inline-flex items-center gap-2 text-gray-400 transition hover:text-cyan-300"
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back to videos
					</Link>
					<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
						<p className="text-lg text-red-300">{error || "Video not found"}</p>
					</div>
				</div>
			</main>
		);
	}

	const creator = video.createdBy ?? "unknown creator";
	const creatorInitial = creator.charAt(0).toUpperCase();

	return (
		<main className="min-h-screen bg-gray-950 px-4 py-8">
			<div className="mx-auto max-w-4xl">
				<Link
					href="/"
					className="mb-6 inline-flex items-center gap-2 text-gray-400 transition hover:text-cyan-300"
				>
					<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
					Back to videos
				</Link>

				{/* Video Player */}
				<div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-black">
					<video
						src={video.videoUrl}
						poster={video.thumbnailUrl}
						controls
						autoPlay
						className="h-full w-full"
					/>
				</div>

				{/* Video Details */}
				<div className="rounded-2xl border border-white/10 bg-white/5 p-8">
					<h1 className="mb-4 text-3xl font-bold text-white">{video.title}</h1>

					{/* Creator Info */}
					<div className="mb-6 flex items-center gap-4 border-b border-white/10 pb-6">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/15 text-lg font-semibold text-cyan-200 ring-2 ring-cyan-500/20">
							{creatorInitial}
						</div>
						<div className="flex-1">
							<p className="text-sm font-medium text-white">{creator}</p>
							<p className="text-xs text-gray-400">{formatDate(video.createdAt)}</p>
						</div>
					</div>

					{/* Description */}
					<div>
						<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Description</h2>
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{video.description}</p>
					</div>
				</div>
			</div>
		</main>
	);
}
