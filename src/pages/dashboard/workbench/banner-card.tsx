import bgImg from "@/assets/images/background/banner-1.png";
import Character from "@/assets/images/characters/image-removebg-preview (2).png";
import { Icon } from "@/components/icon";
import { GLOBAL_CONFIG } from "@/global-config";
import { Button } from "@/ui/button";
import { Text, Title } from "@/ui/typography";
import type { CSSProperties } from "react";

export default function BannerCard() {
  const bgStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `url("${bgImg}")`,
    backgroundSize: "100%",
    backgroundPosition: "50%",
    backgroundRepeat: "no-repeat",
    opacity: 0.5,
  };

  return (
    <div className="relative bg-primary/90">
      <div className="p-6 z-2 relative">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-4">
              <Title as="h2" className="text-white">
                Welcome to {GLOBAL_CONFIG.appName} Dashboard
              </Title>
              <Text className="text-white font-bold italic">
                Here you can monitor and manage your patients' mental health
                efficiently and stay informed about their well-being.
              </Text>

              <Button variant="outline" className="w-fit bg-white text-black mt-2">
                <Icon icon="carbon:logo-slack" size={24} />
                <span className="ml-2 font-black">Get Started</span>
              </Button>
            </div>
          </div>

          <div className="col-span-2 md:col-span-1">
            <div className="w-full h-full flex items-center justify-end">
              <img
                src={Character}
                alt="doctor character"
              />
            </div>
          </div>
        </div>
      </div>
      <div style={bgStyle} className="z-1" />
    </div>
  );
}
