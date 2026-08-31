import { Loader2, Play, RefreshCw, Video } from "lucide-react";
import { useState } from "react";
import {
  createAnimation,
  generateAnimationHtml,
  getAnimationsByUser,
  renderAnimationJob,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { toast } from "../client/hooks/use-toast";

type AnimationStatus = "pending" | "rendering" | "completed" | "failed";

interface Animation {
  id: string;
  prompt: string;
  html: string;
  status: AnimationStatus;
  error: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  duration: number | null;
  fps: number;
}

export function AnimationToVideoSection() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const {
    data: animations,
    isLoading,
    refetch,
  } = useQuery(getAnimationsByUser);

  const handleCreateAnimation = async () => {
    if (!prompt.trim()) {
      toast({
        title: "请输入提示词",
        description: "请描述你想要生成的动画内容",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      const animation = await createAnimation({ prompt: prompt.trim() });
      toast({
        title: "动画创建成功",
        description: "正在生成HTML动画...",
      });

      // Auto-generate HTML after creation
      await handleGenerateHtml(animation.id);

      setPrompt("");
      refetch();
    } catch (error) {
      toast({
        title: "创建失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateHtml = async (animationId: string) => {
    try {
      const animation = await generateAnimationHtml({ animationId });
      toast({
        title: "HTML生成成功",
        description: "正在渲染视频...",
      });
      await handleRenderVideo(animationId);
    } catch (error) {
      toast({
        title: "HTML生成失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    }
  };

  const handleRenderVideo = async (animationId: string) => {
    try {
      setIsRendering(true);

      // Submit background job
      const job = await renderAnimationJob({ animationId });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        await refetch();
        const anim = animations?.find((a: Animation) => a.id === animationId);
        if (anim && (anim.status === "completed" || anim.status === "failed")) {
          clearInterval(pollInterval);
          setIsRendering(false);
          if (anim.status === "completed") {
            toast({
              title: "视频渲染完成!",
              description: "你的动画视频已生成",
            });
          } else {
            toast({
              title: "渲染失败",
              description: anim.error || "未知错误",
              variant: "destructive",
            });
          }
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsRendering(false);
      }, 300000);
    } catch (error) {
      toast({
        title: "渲染失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
      setIsRendering(false);
    }
  };

  const getStatusColor = (status: AnimationStatus) => {
    switch (status) {
      case "pending":
        return "text-yellow-500";
      case "rendering":
        return "text-blue-500";
      case "completed":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getStatusText = (status: AnimationStatus) => {
    switch (status) {
      case "pending":
        return "等待生成";
      case "rendering":
        return "渲染中...";
      case "completed":
        return "已完成";
      case "failed":
        return "失败";
      default:
        return status;
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          HTML 动画转视频
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="描述你想要的动画，例如：旋转的彩色球体，粒子效果..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateAnimation()}
              disabled={isGenerating || isRendering}
              className="flex-1"
            />
            <Button
              onClick={handleCreateAnimation}
              disabled={isGenerating || isRendering || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中
                </>
              ) : (
                "生成动画"
              )}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            输入描述后，AI 将生成 HTML 动画代码，并自动渲染为 MP4 视频
          </p>
        </div>

        {/* Animations List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-muted-foreground py-8 text-center">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
              加载中...
            </div>
          ) : animations && animations.length > 0 ? (
            <div className="space-y-4">
              {animations.map((anim: Animation) => (
                <AnimationCard
                  key={anim.id}
                  animation={anim}
                  onRender={() => handleRenderVideo(anim.id)}
                  onRegenerate={() => handleGenerateHtml(anim.id)}
                  getStatusColor={getStatusColor}
                  getStatusText={getStatusText}
                />
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <Video className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>还没有动画作品</p>
              <p className="text-sm">输入描述开始创建你的第一个动画视频</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AnimationCard({
  animation,
  onRender,
  onRegenerate,
  getStatusColor,
  getStatusText,
}: {
  animation: Animation;
  onRender: () => void;
  onRegenerate: () => void;
  getStatusColor: (s: AnimationStatus) => string;
  getStatusText: (s: AnimationStatus) => string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{animation.prompt}</p>
            <p className={`text-sm ${getStatusColor(animation.status)} mt-1`}>
              {getStatusText(animation.status)}
              {animation.error && (
                <span className="ml-2 text-xs text-red-500">
                  {animation.error}
                </span>
              )}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {new Date(animation.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex gap-2">
            {animation.status === "completed" && animation.videoUrl && (
              <a
                href={animation.videoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <Play className="mr-1 h-4 w-4" />
                  播放
                </Button>
              </a>
            )}

            {(animation.status === "pending" ||
              animation.status === "failed") && (
              <Button variant="outline" size="sm" onClick={onRegenerate}>
                <RefreshCw className="mr-1 h-4 w-4" />
                重新生成
              </Button>
            )}

            {animation.status === "completed" && (
              <Button variant="outline" size="sm" onClick={onRender}>
                <Video className="mr-1 h-4 w-4" />
                重新渲染
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
