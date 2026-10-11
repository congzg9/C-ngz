import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallbackTitle?: string;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		error: null,
		errorInfo: null,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error, errorInfo: null };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Uncaught error in component tree:", error, errorInfo);
		this.setState({ errorInfo });
	}

	public render() {
		if (this.state.hasError) {
			return (
				<div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0e0e11] text-foreground p-6 select-text overflow-auto">
					<div className="max-w-2xl w-full rounded-2xl border border-red-500/20 bg-red-950/20 p-6 shadow-2xl backdrop-blur-xl">
						<div className="flex items-center gap-3 text-red-400 mb-4">
							<span className="text-2xl">⚠️</span>
							<h2 className="text-lg font-semibold tracking-tight">
								{this.props.fallbackTitle || "Đã xảy ra lỗi hiển thị giao diện"}
							</h2>
						</div>
						<p
							className="text-sm mb-3 font-mono p-3 rounded-lg border border-red-500/30 break-all"
							style={{ color: "#ffffff", backgroundColor: "#1e1e24" }}
						>
							{this.state.error?.message || "Lỗi không xác định"}
						</p>
						{this.state.error?.stack && (
							<details open className="mt-3 text-xs">
								<summary className="cursor-pointer mb-2 font-medium" style={{ color: "#f87171" }}>
									Chi tiết Stack Trace (Lỗi cụ thể)
								</summary>
								<pre
									className="overflow-auto max-h-60 p-3 rounded font-mono text-xs select-all"
									style={{ color: "#fca5a5", backgroundColor: "#111116", border: "1px solid #374151" }}
								>
									{this.state.error.stack}
								</pre>
							</details>
						)}
						<div className="mt-5 flex gap-3">
							<button
								type="button"
								onClick={() => window.location.reload()}
								className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
							>
								Tải lại trang (Reload)
							</button>
							<button
								type="button"
								onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
								className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-foreground hover:bg-white/10 transition-colors"
							>
								Thử lại (Retry)
							</button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
