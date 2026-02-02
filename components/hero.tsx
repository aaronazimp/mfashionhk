import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/30" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <Image
              src="/m+logo_final_colorBG.png"
              alt="M+ Fashion Logo"
              width={180}
              height={180}
              priority
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight text-balance">
            優雅時尚
            <br />
            <span className="text-primary">源自品味</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto text-pretty">
            M+ Fashion 精選高品質時尚單品，為您打造獨特的個人風格
          </p>
          <div className="flex flex-col items-center justify-center gap-6">
            <Button 
                size="lg" 
                className="w-full sm:w-auto px-10 py-7 bg-gradient-to-r from-[#A87C73] to-[#d49e92] text-white text-xl font-bold rounded-full shadow-[0_0_20px_rgba(168,124,115,0.5)] cursor-default"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 fill-yellow-300 text-yellow-100" />
                限時搶購(即將推出)
                <Zap className="w-5 h-5 fill-yellow-300 text-yellow-100" />
              </div>
            </Button>

            <Button asChild variant="link" size="lg" className="text-muted-foreground hover:text-primary transition-colors text-base font-normal">
              <Link href="/#products" className="flex items-center gap-1">
                瀏覽所有 Live 精選商品
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
