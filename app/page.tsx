"use client";

import FileUpload from "./components/FileUpload";
import type { UploadResponse } from "@imagekit/next";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type VideoItem = {
	_id: string;
	title: string;
	description: string;
	videoUrl: string;
	thumbnailUrl: string;
	createdBy?: string;
	createdAt?: string;
};

const getFallbackThumbnail = (url: string) => `${url}/ik-thumbnail.jpg`;
const formatDate = (date?: string) => {
	if (!date) {
		return "Unknown date";
	}
	return new Date(date).toLocaleDateString();
};

export default function HomePage() {
	const { data: session, status } = useSession();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [aiBrief, setAiBrief] = useState("");
	const [videoUrl, setVideoUrl] = useState("");
	const [thumbnailUrl, setThumbnailUrl] = useState("");
	const [uploadProgress, setUploadProgress] = useState(0);
	const [saving, setSaving] = useState(false);
	const [aiLoadingMode, setAiLoadingMode] = useState<"draft" | "improve" | null>(null);
	const [videos, setVideos] = useState<VideoItem[]>([]);
	const [loadingVideos, setLoadingVideos] = useState(true);
	const [search, setSearch] = useState("");
	const [sortBy, setSortBy] = useState<"latest" | "oldest" | "title">("latest");
	const [showOnlyMine, setShowOnlyMine] = useState(false);
	const [feedback, setFeedback] = useState<string>("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const fetchVideos = async () => {
		setLoadingVideos(true);
		try {
			const res = await fetch("/api/video");
			const data = await res.json();
			if (res.ok) {
				setVideos(data);
			}
		} catch (error) {
			console.error("Failed to fetch videos", error);
		} finally {
			setLoadingVideos(false);
		}
	};

	const filteredVideos = useMemo(() => {
		const query = search.trim().toLowerCase();
		let nextVideos = [...videos];

		if (query) {
			nextVideos = nextVideos.filter(
				(video) =>
					video.title.toLowerCase().includes(query) ||
					video.description.toLowerCase().includes(query) ||
					(video.createdBy ?? "").toLowerCase().includes(query)
			);
		}

		if (showOnlyMine && session?.user?.email) {
			nextVideos = nextVideos.filter((video) => video.createdBy === session.user?.email);
		}

		nextVideos.sort((a, b) => {
			if (sortBy === "title") {
				return a.title.localeCompare(b.title);
			}

			const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
			const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

			return sortBy === "latest" ? timeB - timeA : timeA - timeB;
		});

		return nextVideos;
	}, [search, session?.user?.email, showOnlyMine, sortBy, videos]);

	const creatorCount = useMemo(() => {
		return new Set(videos.map((video) => video.createdBy ?? "unknown")).size;
	}, [videos]);

	useEffect(() => {
		void fetchVideos();
	}, []);

	const handleVideoUpload = (res: UploadResponse) => {
		if (!res.url) {
			return;
		}
		setVideoUrl(res.url);
		setThumbnailUrl(res.thumbnailUrl ?? getFallbackThumbnail(res.url));
	};

	const handleCreateVideo = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFeedback("");

		if (!title || !description || !videoUrl) {
			setFeedback("Please fill all fields and upload a video before saving.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch("/api/video", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title,
					description,
					videoUrl,
					thumbnailUrl: thumbnailUrl || getFallbackThumbnail(videoUrl),
				}),
			});

			if (!res.ok) {
				const message = await getResponseError(res, "Failed to save video");
				throw new Error(message);
			}

			setTitle("");
			setDescription("");
			setVideoUrl("");
			setThumbnailUrl("");
			setUploadProgress(0);
			setFeedback("Video published successfully.");
			await fetchVideos();
		} catch (error) {
			console.error(error);
			setFeedback("Unable to save video. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteVideo = async (id: string) => {
		setDeletingId(id);
		setFeedback("");

		try {
			const res = await fetch(`/api/video/${id}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const raw = await res.text();
				let message = "Failed to delete video";

				if (raw) {
					try {
						const parsed = JSON.parse(raw) as { error?: string };
						message = parsed.error || message;
					} catch {
						message = raw;
					}
				}

				throw new Error(message);
			}

			setVideos((prev) => prev.filter((video) => video._id !== id));
			setFeedback("Video deleted.");
		} catch (error) {
			console.error(error);
			setFeedback(error instanceof Error ? error.message : "Unable to delete video.");
		} finally {
			setDeletingId(null);
		}
	};

	const copyVideoLink = async (video: VideoItem) => {
		try {
			await navigator.clipboard.writeText(video.videoUrl);
			setFeedback("Video link copied.");
		} catch {
			setFeedback("Could not copy link. Please copy manually.");
		}
	};

	const getResponseError = async (res: Response, fallbackMessage: string) => {
		const raw = await res.text();
		if (!raw) {
			return fallbackMessage;
		}

		try {
			const parsed = JSON.parse(raw) as { error?: string; message?: string };
			return parsed.error || parsed.message || fallbackMessage;
		} catch {
			return raw;
		}
	};

	const handleAiAssist = async (mode: "draft" | "improve") => {
		setFeedback("");
		setAiLoadingMode(mode);

		try {
			const res = await fetch("/api/ai/suggest", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					mode,
					brief: aiBrief,
					title,
					description,
				}),
			});

			if (!res.ok) {
				const message = await getResponseError(res, "AI request failed");
				throw new Error(message);
			}

			const raw = await res.text();
			if (!raw) {
				throw new Error("AI returned an empty response.");
			}

			const data = JSON.parse(raw) as {
				title?: string;
				description?: string;
				source?: "openai" | "groq" | "openrouter" | "gemini" | "fallback";
			};

			if (mode === "draft" && data.title) {
				setTitle(data.title);
			}

			if (data.description) {
				setDescription(data.description);
			}

			const sourceLabelMap: Record<string, string> = {
				openai: "OpenAI",
				gemini: "Gemini",
				groq: "Groq",
				openrouter: "OpenRouter",
				fallback: "smart fallback",
			};
			const sourceLabel = sourceLabelMap[data.source ?? "fallback"];
			setFeedback(
				mode === "draft"
					? `Draft generated with ${sourceLabel}.`
					: `Description improved with ${sourceLabel}.`
			);
		} catch (error) {
			console.error(error);
			setFeedback(error instanceof Error ? error.message : "Unable to generate AI suggestion.");
		} finally {
			setAiLoadingMode(null);
		}
	};

	return (
		<main className="relative min-h-screen overflow-hidden bg-black text-white">
			<div className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
				<div className="absolute right-[-8%] top-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
				<div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/5 blur-3xl" />
			</div>
			{/* Header */}
			<header className="sticky top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-xl">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
					<div className="flex items-center gap-2">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-blue-500 via-cyan-500 to-emerald-400 text-sm font-black text-black shadow-lg shadow-cyan-500/20">
							AI
						</div>
						<div>
							<h1 className="text-lg font-bold leading-none">AI Studio</h1>
							<p className="text-[11px] text-gray-400">Video publishing workspace</p>
						</div>
					</div>
					<nav className="flex items-center gap-3">
						{status === "loading" ? null : session ? (
							<>
								<div className="hidden text-sm text-gray-400 sm:block">{session.user?.email}</div>
								<button
									onClick={() => signOut({ callbackUrl: "/" })}
									className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium transition hover:bg-gray-800"
								>
									Logout
								</button>
							</>
						) : (
							<div className="flex items-center gap-2">
								<Link
									href="/login"
									className="rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-gray-900"
								>
									Login
								</Link>
								<Link
									href="/register"
									className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition hover:bg-blue-700"
								>
									Register
								</Link>
							</div>
						)}
					</nav>
				</div>
			</header>

			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				{/* Hero Section */}
				<section className="mb-12 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-10">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
						<span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
						AI-assisted publishing
					</div>
					<h2 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
						Upload, refine, and publish videos with a cleaner workflow.
					</h2>
					<p className="mt-4 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
						Use AI to draft better titles and descriptions, then manage your library in one focused dashboard.
					</p>
					<div className="mt-6 flex flex-wrap gap-3">
						<span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-gray-200">Smart drafts</span>
						<span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-gray-200">Fast upload</span>
						<span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-gray-200">Clean library</span>
					</div>
				</section>

				{/* Upload Section */}
				{session && (
					<section className="mb-12 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
						<div className="mb-8 flex items-center justify-between gap-4">
							<div>
								<h2 className="text-2xl font-bold">Upload Your Video</h2>
								<p className="mt-1 text-sm text-gray-400">Draft with AI first, then publish with a clean form.</p>
							</div>
							<div className="hidden rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-gray-300 sm:block">
								Creator tools
							</div>
						</div>
						<form onSubmit={handleCreateVideo} className="space-y-6">
							<div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-4">
								<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<p className="text-sm font-semibold text-cyan-300">AI Assistant</p>
										<p className="text-xs text-cyan-100/80">Generate title/description drafts or improve your current description.</p>
									</div>
									<span className="rounded-full border border-cyan-700/60 px-2 py-1 text-[11px] text-cyan-200">AI Studio</span>
								</div>
								<input
									type="text"
									placeholder="AI brief (topic, audience, style)..."
									value={aiBrief}
									onChange={(event) => setAiBrief(event.target.value)}
									className="w-full rounded-lg border border-cyan-900/60 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-cyan-100/50 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
								/>
								<div className="mt-3 flex flex-col gap-2 sm:flex-row">
									<button
										type="button"
										onClick={() => handleAiAssist("draft")}
										disabled={aiLoadingMode !== null}
										className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-60"
									>
										{aiLoadingMode === "draft" ? "Generating draft..." : "Generate AI Draft"}
									</button>
									<button
										type="button"
										onClick={() => handleAiAssist("improve")}
										disabled={aiLoadingMode !== null}
										className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700 disabled:opacity-60"
									>
										{aiLoadingMode === "improve" ? "Improving..." : "Improve Description"}
									</button>
								</div>
							</div>

							<div className="grid gap-6 lg:grid-cols-2">
								<div>
									<label className="mb-3 block text-sm font-semibold text-white">Video Title *</label>
									<input
										type="text"
										placeholder="Enter an engaging title for your video"
										value={title}
										onChange={(event) => setTitle(event.target.value)}
										className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
									/>
								</div>

								<div>
									<label className="mb-3 block text-sm font-semibold text-white">Video File *</label>
									<FileUpload
										fileType="video"
										onProgress={setUploadProgress}
										onSuccess={handleVideoUpload}
									/>
									{videoUrl && (
										<div className="mt-3 rounded-xl border border-green-900/50 bg-green-900/20 p-2.5 text-center">
											<p className="text-xs text-green-400">✓ Video uploaded</p>
										</div>
									)}
								</div>
							</div>

							<div>
								<label className="mb-3 block text-sm font-semibold text-white">Description *</label>
								<textarea
									placeholder="Describe what your video is about..."
									value={description}
									onChange={(event) => setDescription(event.target.value)}
									rows={4}
									className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
								/>
							</div>

							{uploadProgress > 0 && uploadProgress < 100 && (
								<div className="rounded-xl border border-white/10 bg-black/25 p-4">
									<div className="mb-2 flex justify-between">
										<p className="text-xs font-medium text-gray-300">Uploading...</p>
										<p className="text-xs font-semibold text-blue-400">{uploadProgress}%</p>
									</div>
									<div className="h-2 w-full rounded-full bg-gray-700">
										<div
											className="h-full rounded-full bg-linear-to-r from-blue-600 to-cyan-600 transition-all"
											style={{ width: `${uploadProgress}%` }}
										/>
									</div>
								</div>
							)}

							<div className="flex justify-start">
								<button
									type="submit"
									disabled={saving}
									className="w-full rounded-xl bg-linear-to-r from-blue-500 via-cyan-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-cyan-500/20 transition duration-200 enabled:hover:from-blue-400 enabled:hover:to-emerald-300 disabled:opacity-60 sm:w-auto sm:min-w-48"
								>
									{saving ? "Publishing..." : "Publish Video"}
								</button>
							</div>

							{feedback && (
								<div className={`rounded-lg p-3 text-sm font-medium ${feedback.includes("successfully") ? "border border-green-900/50 bg-green-900/20 text-green-400" : "border border-red-900/50 bg-red-900/20 text-red-400"}`}>
									{feedback}
								</div>
							)}
						</form>
					</section>
				)}

				{!session && (
						<section className="mb-12 rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
						<p className="mb-4 text-lg text-gray-300">Want to upload videos?</p>
						<Link
							href="/login"
							className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
						>
							Sign In to Upload
						</Link>
					</section>
				)}

				{/* Browse Section */}
				<section>
					<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h2 className="text-3xl font-bold">Discover Videos</h2>
							<p className="mt-1 text-sm text-gray-400">Explore and watch videos from the community</p>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row">
							<input
								type="text"
								placeholder="Search videos..."
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							/>
							<select
								value={sortBy}
								onChange={(event) => setSortBy(event.target.value as "latest" | "oldest" | "title")}
								className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							>
								<option value="latest">Latest</option>
								<option value="oldest">Oldest</option>
								<option value="title">Title A-Z</option>
							</select>
							{session && (
								<label className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm transition hover:bg-gray-700">
									<input
										type="checkbox"
										checked={showOnlyMine}
										onChange={(event) => setShowOnlyMine(event.target.checked)}
										className="cursor-pointer"
									/>
									<span className="cursor-pointer">My Videos</span>
								</label>
							)}
						</div>
					</div>

					{loadingVideos ? (
						<div className="flex items-center justify-center py-16">
							<p className="text-gray-400">Loading videos...</p>
						</div>
					) : filteredVideos.length === 0 ? (
						<div className="rounded-2xl border border-gray-800 bg-gray-900/30 py-16 text-center">
							<p className="text-lg text-gray-400">No videos found</p>
						</div>
					) : (
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{filteredVideos.map((video) => {
								const creator = video.createdBy ?? "unknown creator";
								const canDelete =
									(session?.user?.id === video.createdBy || session?.user?.email === video.createdBy) ||
									(!video.createdBy && session);

								return (
									<article
										key={video._id}
										className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-0.5 hover:border-cyan-500/30 hover:bg-white/7"
									>
<Link href={`/watch/${video._id}`} className="block">
										<div className="relative aspect-video overflow-hidden bg-black">
											<video
												src={video.videoUrl}
												poster={video.thumbnailUrl}
												className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
											/>
											<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/65 via-black/5 to-transparent" />
											<div className="absolute bottom-2 right-2 rounded-md bg-black/85 px-2 py-1 text-[10px] font-semibold text-white">
												Watch now
											</div>
											<div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
												<div className="rounded-full bg-white/90 p-2.5 text-black shadow-xl">
													<svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
														<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
													</svg>
												</div>
											</div>
										</div>
									</Link>

										<div className="p-4">
											<div className="flex items-start gap-3">
												<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[11px] font-semibold uppercase text-cyan-200 ring-1 ring-cyan-500/20">
													{creator.charAt(0)}
												</div>
												<div className="min-w-0 flex-1">
													<h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">
														{video.title}
													</h3>
													<p className="mt-1 text-[11px] text-gray-400">
														{creator} • {formatDate(video.createdAt)}
													</p>
													<p className="mt-1.5 line-clamp-2 text-[11px] text-gray-500">{video.description}</p>
												</div>
											</div>

											<div className="mt-4 flex gap-2">
												<button
													onClick={() => copyVideoLink(video)}
													className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-medium text-gray-100 transition hover:border-cyan-500/30 hover:bg-black/45"
												>
													Copy link
												</button>
												{canDelete && (
													<button
														onClick={() => handleDeleteVideo(video._id)}
														disabled={deletingId === video._id}
														className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
													>
														{deletingId === video._id ? "Deleting..." : "Delete"}
													</button>
												)}
											</div>
										</div>
									</article>
								);
							})}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
