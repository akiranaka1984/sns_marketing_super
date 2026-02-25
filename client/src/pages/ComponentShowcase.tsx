import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  AlertCircle,
  CalendarIcon,
  Check,
  Clock,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast as sonnerToast } from "sonner";
import { AIChatBox, type Message } from "@/components/AIChatBox";

export default function ComponentsShowcase() {
  const { theme, toggleTheme } = useTheme();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [datePickerDate, setDatePickerDate] = useState<Date>();
  const [selectedFruits, setSelectedFruits] = useState<string[]>([]);
  const [progress, setProgress] = useState(33);
  const [currentPage, setCurrentPage] = useState(2);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [dialogInput, setDialogInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // AI ChatBox demo state
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: "system", content: "You are a helpful assistant." },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleDialogSubmit = () => {
    console.log("Dialog submitted with value:", dialogInput);
    sonnerToast.success("Submitted successfully", {
      description: `Input: ${dialogInput}`,
    });
    setDialogInput("");
    setDialogOpen(false);
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleDialogSubmit();
    }
  };

  const handleChatSend = (content: string) => {
    // Add user message
    const newMessages: Message[] = [...chatMessages, { role: "user", content }];
    setChatMessages(newMessages);

    // Simulate AI response with delay
    setIsChatLoading(true);
    setTimeout(() => {
      const aiResponse: Message = {
        role: "assistant",
        content: `This is a **demo response**. In a real app, you would call a tRPC mutation here:\n\n\`\`\`typescript\nconst chatMutation = trpc.ai.chat.useMutation({\n  onSuccess: (response) => {\n    setChatMessages(prev => [...prev, {\n      role: "assistant",\n      content: response.choices[0].message.content\n    }]);\n  }\n});\n\nchatMutation.mutate({ messages: newMessages });\n\`\`\`\n\nYour message was: "${content}"`,
      };
      setChatMessages([...newMessages, aiResponse]);
      setIsChatLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#1A1A1A]">
      <main className="container max-w-6xl mx-auto py-8">
        <div className="space-y-2 justify-between flex mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">
            Shadcn/ui Component Library
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="space-y-12">
          {/* Text Colors Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Text Colors</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-[#6B6B6B] font-bold mb-1">
                        Foreground (Default)
                      </p>
                      <p className="text-[#1A1A1A] text-lg font-bold">
                        Default text color for main content
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B6B6B] font-bold mb-1">
                        Muted Foreground
                      </p>
                      <p className="text-[#6B6B6B] text-lg font-bold">
                        Muted text for secondary information
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B6B6B] font-bold mb-1">
                        Primary
                      </p>
                      <p className="text-[#FFD700] text-lg font-bold">
                        Primary brand color text
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-[#6B6B6B] font-bold mb-1">
                        Accent
                      </p>
                      <p className="text-[#4ECDC4] text-lg font-bold">
                        Accent text for emphasis
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B6B6B] font-bold mb-1">
                        Destructive
                      </p>
                      <p className="text-[#FF6B6B] text-lg font-bold">
                        Error or destructive action text
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Color Combinations Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Color Combinations</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-[#FFD700] text-[#1A1A1A] rounded-lg p-4 border-2 border-[#1A1A1A]">
                    <p className="font-bold mb-1">Primary Yellow</p>
                    <p className="text-sm font-bold opacity-90">
                      Primary background with foreground text
                    </p>
                  </div>
                  <div className="bg-[#4ECDC4] text-[#1A1A1A] rounded-lg p-4 border-2 border-[#1A1A1A]">
                    <p className="font-bold mb-1">Teal</p>
                    <p className="text-sm font-bold opacity-90">
                      Secondary background with foreground text
                    </p>
                  </div>
                  <div className="bg-[#A8E6CF] text-[#1A1A1A] rounded-lg p-4 border-2 border-[#1A1A1A]">
                    <p className="font-bold mb-1">Mint</p>
                    <p className="text-sm font-bold opacity-90">
                      Muted background with foreground text
                    </p>
                  </div>
                  <div className="bg-[#FF6B6B] text-[#1A1A1A] rounded-lg p-4 border-2 border-[#1A1A1A]">
                    <p className="font-bold mb-1">Coral</p>
                    <p className="text-sm font-bold opacity-90">
                      Accent background with foreground text
                    </p>
                  </div>
                  <div className="bg-[#DDA0DD] text-[#1A1A1A] rounded-lg p-4 border-2 border-[#1A1A1A]">
                    <p className="font-bold mb-1">Lavender</p>
                    <p className="text-sm font-bold opacity-90">
                      Destructive background with foreground text
                    </p>
                  </div>
                  <div className="bg-[#FFFDF7] text-[#1A1A1A] rounded-lg p-4 border-2 border-[#1A1A1A]">
                    <p className="font-bold mb-1">Background</p>
                    <p className="text-sm font-bold opacity-90">
                      Default background with foreground text
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Buttons Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Buttons</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <Button className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    Default
                  </Button>
                  <Button variant="secondary" className="bg-[#4ECDC4] hover:bg-[#4ECDC4] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    Secondary
                  </Button>
                  <Button variant="destructive" className="bg-[#FF6B6B] hover:bg-[#FF6B6B] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    Destructive
                  </Button>
                  <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">
                    Outline
                  </Button>
                  <Button variant="ghost" className="font-bold">
                    Ghost
                  </Button>
                  <Button variant="link" className="font-bold">
                    Link
                  </Button>
                  <Button size="sm" className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                    Small
                  </Button>
                  <Button size="lg" className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[6px_6px_0_#1A1A1A] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                    Large
                  </Button>
                  <Button size="icon" className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Form Inputs Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Form Inputs</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-[#1A1A1A]">Email</Label>
                  <Input id="email" type="email" placeholder="Email" className="border-2 border-[#1A1A1A] rounded-lg font-bold" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="font-bold text-[#1A1A1A]">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here."
                    className="border-2 border-[#1A1A1A] rounded-lg font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Select</Label>
                  <Select>
                    <SelectTrigger className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                      <SelectValue placeholder="Select a fruit" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                      <SelectItem value="apple" className="font-bold">Apple</SelectItem>
                      <SelectItem value="banana" className="font-bold">Banana</SelectItem>
                      <SelectItem value="orange" className="font-bold">Orange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="terms" className="border-2 border-[#1A1A1A]" />
                  <Label htmlFor="terms" className="font-bold text-[#1A1A1A]">Accept terms and conditions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="airplane-mode" className="border-2 border-[#1A1A1A]" />
                  <Label htmlFor="airplane-mode" className="font-bold text-[#1A1A1A]">Airplane Mode</Label>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Radio Group</Label>
                  <RadioGroup defaultValue="option-one">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option-one" id="option-one" className="border-2 border-[#1A1A1A]" />
                      <Label htmlFor="option-one" className="font-bold text-[#1A1A1A]">Option One</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option-two" id="option-two" className="border-2 border-[#1A1A1A]" />
                      <Label htmlFor="option-two" className="font-bold text-[#1A1A1A]">Option Two</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Slider</Label>
                  <Slider defaultValue={[50]} max={100} step={1} />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Input OTP</Label>
                  <InputOTP maxLength={6}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="border-2 border-[#1A1A1A] font-bold" />
                      <InputOTPSlot index={1} className="border-2 border-[#1A1A1A] font-bold" />
                      <InputOTPSlot index={2} className="border-2 border-[#1A1A1A] font-bold" />
                      <InputOTPSlot index={3} className="border-2 border-[#1A1A1A] font-bold" />
                      <InputOTPSlot index={4} className="border-2 border-[#1A1A1A] font-bold" />
                      <InputOTPSlot index={5} className="border-2 border-[#1A1A1A] font-bold" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Date Time Picker</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all ${
                          !datePickerDate && "text-[#6B6B6B]"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {datePickerDate ? (
                          format(datePickerDate, "PPP HH:mm", { locale: zhCN })
                        ) : (
                          <span>Select date and time</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]" align="start">
                      <div className="p-3 space-y-3">
                        <Calendar
                          mode="single"
                          selected={datePickerDate}
                          onSelect={setDatePickerDate}
                          className="border-2 border-[#1A1A1A] rounded-lg"
                        />
                        <div className="border-t-2 border-[#1A1A1A] pt-3 space-y-2">
                          <Label className="flex items-center gap-2 font-bold text-[#1A1A1A]">
                            <Clock className="h-4 w-4" />
                            Time
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              type="time"
                              value={
                                datePickerDate
                                  ? format(datePickerDate, "HH:mm")
                                  : "00:00"
                              }
                              onChange={e => {
                                const [hours, minutes] =
                                  e.target.value.split(":");
                                const newDate = datePickerDate
                                  ? new Date(datePickerDate)
                                  : new Date();
                                newDate.setHours(parseInt(hours));
                                newDate.setMinutes(parseInt(minutes));
                                setDatePickerDate(newDate);
                              }}
                              className="border-2 border-[#1A1A1A] rounded-lg font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {datePickerDate && (
                    <p className="text-sm text-[#6B6B6B] font-bold">
                      Selected:{" "}
                      {format(datePickerDate, "yyyy/MM/dd  HH:mm", {
                        locale: zhCN,
                      })}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Searchable Dropdown</Label>
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full justify-between font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                      >
                        {selectedFramework
                          ? [
                              { value: "react", label: "React" },
                              { value: "vue", label: "Vue" },
                              { value: "angular", label: "Angular" },
                              { value: "svelte", label: "Svelte" },
                              { value: "nextjs", label: "Next.js" },
                              { value: "nuxt", label: "Nuxt" },
                              { value: "remix", label: "Remix" },
                            ].find(fw => fw.value === selectedFramework)?.label
                          : "Select framework..."}
                        <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                      <Command>
                        <CommandInput placeholder="Search frameworks..." className="font-bold" />
                        <CommandList>
                          <CommandEmpty className="font-bold">No framework found</CommandEmpty>
                          <CommandGroup>
                            {[
                              { value: "react", label: "React" },
                              { value: "vue", label: "Vue" },
                              { value: "angular", label: "Angular" },
                              { value: "svelte", label: "Svelte" },
                              { value: "nextjs", label: "Next.js" },
                              { value: "nuxt", label: "Nuxt" },
                              { value: "remix", label: "Remix" },
                            ].map(framework => (
                              <CommandItem
                                key={framework.value}
                                value={framework.value}
                                onSelect={currentValue => {
                                  setSelectedFramework(
                                    currentValue === selectedFramework
                                      ? ""
                                      : currentValue
                                  );
                                  setOpenCombobox(false);
                                }}
                                className="font-bold"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedFramework === framework.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                {framework.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedFramework && (
                    <p className="text-sm text-[#6B6B6B] font-bold">
                      Selected:{" "}
                      {
                        [
                          { value: "react", label: "React" },
                          { value: "vue", label: "Vue" },
                          { value: "angular", label: "Angular" },
                          { value: "svelte", label: "Svelte" },
                          { value: "nextjs", label: "Next.js" },
                          { value: "nuxt", label: "Nuxt" },
                          { value: "remix", label: "Remix" },
                        ].find(fw => fw.value === selectedFramework)?.label
                      }
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="month" className="text-sm font-bold text-[#1A1A1A]">
                        Month
                      </Label>
                      <Select
                        value={selectedMonth}
                        onValueChange={setSelectedMonth}
                      >
                        <SelectTrigger id="month" className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            month => (
                              <SelectItem
                                key={month}
                                value={month.toString().padStart(2, "0")}
                                className="font-bold"
                              >
                                {month.toString().padStart(2, "0")}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year" className="text-sm font-bold text-[#1A1A1A]">
                        Year
                      </Label>
                      <Select
                        value={selectedYear}
                        onValueChange={setSelectedYear}
                      >
                        <SelectTrigger id="year" className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                          <SelectValue placeholder="YYYY" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                          {Array.from(
                            { length: 10 },
                            (_, i) => new Date().getFullYear() - 5 + i
                          ).map(year => (
                            <SelectItem key={year} value={year.toString()} className="font-bold">
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedMonth && selectedYear && (
                    <p className="text-sm text-[#6B6B6B] font-bold">
                      Selected: {selectedYear}/{selectedMonth}/
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Data Display Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Data Display</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Badges</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] font-bold">Default</Badge>
                    <Badge variant="secondary" className="bg-[#4ECDC4] text-[#1A1A1A] border-2 border-[#1A1A1A] font-bold">Secondary</Badge>
                    <Badge variant="destructive" className="bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A] font-bold">Destructive</Badge>
                    <Badge variant="outline" className="border-2 border-[#1A1A1A] font-bold">Outline</Badge>
                  </div>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Avatar</Label>
                  <div className="flex gap-4">
                    <Avatar className="border-2 border-[#1A1A1A]">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback className="bg-[#DDA0DD] text-[#1A1A1A] font-bold">CN</AvatarFallback>
                    </Avatar>
                    <Avatar className="border-2 border-[#1A1A1A]">
                      <AvatarFallback className="bg-[#87CEEB] text-[#1A1A1A] font-bold">AB</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Progress</Label>
                  <Progress value={progress} className="border-2 border-[#1A1A1A]" />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setProgress(Math.max(0, progress - 10))}
                      className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                    >
                      -10
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setProgress(Math.min(100, progress + 10))}
                      className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                    >
                      +10
                    </Button>
                  </div>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Skeleton</Label>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full bg-[#6B6B6B]/20 border-2 border-[#1A1A1A]" />
                    <Skeleton className="h-4 w-3/4 bg-[#6B6B6B]/20 border-2 border-[#1A1A1A]" />
                    <Skeleton className="h-4 w-1/2 bg-[#6B6B6B]/20 border-2 border-[#1A1A1A]" />
                  </div>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Pagination</Label>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={e => {
                            e.preventDefault();
                            setCurrentPage(Math.max(1, currentPage - 1));
                          }}
                          className="border-2 border-[#1A1A1A] rounded-lg font-bold"
                        />
                      </PaginationItem>
                      {[1, 2, 3, 4, 5].map(page => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === page}
                            onClick={e => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            className={`border-2 border-[#1A1A1A] rounded-lg font-bold ${
                              currentPage === page
                                ? "bg-[#FFD700] text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]"
                                : ""
                            }`}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={e => {
                            e.preventDefault();
                            setCurrentPage(Math.min(5, currentPage + 1));
                          }}
                          className="border-2 border-[#1A1A1A] rounded-lg font-bold"
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  <p className="text-sm text-[#6B6B6B] font-bold text-center">
                    Current page: {currentPage}
                  </p>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Table</Label>
                  <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden">
                    <Table>
                      <TableCaption className="font-bold text-[#6B6B6B]">A list of your recent invoices.</TableCaption>
                      <TableHeader className="bg-[#FFD700]">
                        <TableRow className="border-b-2 border-[#1A1A1A]">
                          <TableHead className="w-[100px] font-bold text-[#1A1A1A]">Invoice</TableHead>
                          <TableHead className="font-bold text-[#1A1A1A]">Status</TableHead>
                          <TableHead className="font-bold text-[#1A1A1A]">Method</TableHead>
                          <TableHead className="text-right font-bold text-[#1A1A1A]">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="border-b-2 border-[#1A1A1A]">
                          <TableCell className="font-bold">INV001</TableCell>
                          <TableCell className="font-bold">Paid</TableCell>
                          <TableCell className="font-bold">Credit Card</TableCell>
                          <TableCell className="text-right font-bold">$250.00</TableCell>
                        </TableRow>
                        <TableRow className="border-b-2 border-[#1A1A1A]">
                          <TableCell className="font-bold">INV002</TableCell>
                          <TableCell className="font-bold">Pending</TableCell>
                          <TableCell className="font-bold">PayPal</TableCell>
                          <TableCell className="text-right font-bold">$150.00</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-bold">INV003</TableCell>
                          <TableCell className="font-bold">Unpaid</TableCell>
                          <TableCell className="font-bold">Bank Transfer</TableCell>
                          <TableCell className="text-right font-bold">$350.00</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Menubar</Label>
                  <Menubar className="border-2 border-[#1A1A1A] rounded-lg">
                    <MenubarMenu>
                      <MenubarTrigger className="font-bold">File</MenubarTrigger>
                      <MenubarContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                        <MenubarItem className="font-bold">New Tab</MenubarItem>
                        <MenubarItem className="font-bold">New Window</MenubarItem>
                        <MenubarSeparator className="bg-[#1A1A1A]" />
                        <MenubarItem className="font-bold">Share</MenubarItem>
                        <MenubarSeparator className="bg-[#1A1A1A]" />
                        <MenubarItem className="font-bold">Print</MenubarItem>
                      </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                      <MenubarTrigger className="font-bold">Edit</MenubarTrigger>
                      <MenubarContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                        <MenubarItem className="font-bold">Undo</MenubarItem>
                        <MenubarItem className="font-bold">Redo</MenubarItem>
                      </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                      <MenubarTrigger className="font-bold">View</MenubarTrigger>
                      <MenubarContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                        <MenubarItem className="font-bold">Reload</MenubarItem>
                        <MenubarItem className="font-bold">Force Reload</MenubarItem>
                      </MenubarContent>
                    </MenubarMenu>
                  </Menubar>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Breadcrumb</Label>
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="/" className="font-bold">Home</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink href="/components" className="font-bold">
                          Components
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="font-bold">Breadcrumb</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Alerts Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Alerts</h3>
            <div className="space-y-4">
              <Alert className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-bold text-[#1A1A1A]">Heads up!</AlertTitle>
                <AlertDescription className="font-bold text-[#6B6B6B]">
                  You can add components to your app using the cli.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive" className="border-2 border-[#FF6B6B] shadow-[4px_4px_0_#FF6B6B] rounded-lg bg-[#FF6B6B]/20">
                <X className="h-4 w-4" />
                <AlertTitle className="font-bold text-[#1A1A1A]">Error</AlertTitle>
                <AlertDescription className="font-bold text-[#1A1A1A]">
                  Your session has expired. Please log in again.
                </AlertDescription>
              </Alert>
            </div>
          </section>

          {/* Tabs Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Tabs</h3>
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="grid w-full grid-cols-3 border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7]">
                <TabsTrigger value="account" className="font-bold data-[state=active]:bg-[#FFD700] data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-[2px_2px_0_#1A1A1A]">Account</TabsTrigger>
                <TabsTrigger value="password" className="font-bold data-[state=active]:bg-[#FFD700] data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-[2px_2px_0_#1A1A1A]">Password</TabsTrigger>
                <TabsTrigger value="settings" className="font-bold data-[state=active]:bg-[#FFD700] data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-[2px_2px_0_#1A1A1A]">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="account">
                <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                  <CardHeader>
                    <CardTitle className="font-bold text-[#1A1A1A]">Account</CardTitle>
                    <CardDescription className="font-bold text-[#6B6B6B]">
                      Make changes to your account here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="name" className="font-bold text-[#1A1A1A]">Name</Label>
                      <Input id="name" defaultValue="Pedro Duarte" className="border-2 border-[#1A1A1A] rounded-lg font-bold" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">Save changes</Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              <TabsContent value="password">
                <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                  <CardHeader>
                    <CardTitle className="font-bold text-[#1A1A1A]">Password</CardTitle>
                    <CardDescription className="font-bold text-[#6B6B6B]">
                      Change your password here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="current" className="font-bold text-[#1A1A1A]">Current password</Label>
                      <Input id="current" type="password" className="border-2 border-[#1A1A1A] rounded-lg font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new" className="font-bold text-[#1A1A1A]">New password</Label>
                      <Input id="new" type="password" className="border-2 border-[#1A1A1A] rounded-lg font-bold" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">Save password</Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              <TabsContent value="settings">
                <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                  <CardHeader>
                    <CardTitle className="font-bold text-[#1A1A1A]">Settings</CardTitle>
                    <CardDescription className="font-bold text-[#6B6B6B]">
                      Manage your settings here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-[#6B6B6B] font-bold">
                      Settings content goes here.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>

          {/* Accordion Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Accordion</h3>
            <Accordion type="single" collapsible className="w-full border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7] shadow-[4px_4px_0_#1A1A1A]">
              <AccordionItem value="item-1" className="border-b-2 border-[#1A1A1A]">
                <AccordionTrigger className="font-bold text-[#1A1A1A] px-4">Is it accessible?</AccordionTrigger>
                <AccordionContent className="font-bold text-[#6B6B6B] px-4">
                  Yes. It adheres to the WAI-ARIA design pattern.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-b-2 border-[#1A1A1A]">
                <AccordionTrigger className="font-bold text-[#1A1A1A] px-4">Is it styled?</AccordionTrigger>
                <AccordionContent className="font-bold text-[#6B6B6B] px-4">
                  Yes. It comes with default styles that matches the other
                  components' aesthetic.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="font-bold text-[#1A1A1A] px-4">Is it animated?</AccordionTrigger>
                <AccordionContent className="font-bold text-[#6B6B6B] px-4">
                  Yes. It's animated by default, but you can disable it if you
                  prefer.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          {/* Collapsible Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Collapsible</h3>
            <Collapsible>
              <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between font-bold">
                      <CardTitle className="font-bold text-[#1A1A1A]">@peduarte starred 3 repositories</CardTitle>
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="rounded-lg border-2 border-[#1A1A1A] px-4 py-3 font-mono text-sm font-bold">
                        @radix-ui/primitives
                      </div>
                      <div className="rounded-lg border-2 border-[#1A1A1A] px-4 py-3 font-mono text-sm font-bold">
                        @radix-ui/colors
                      </div>
                      <div className="rounded-lg border-2 border-[#1A1A1A] px-4 py-3 font-mono text-sm font-bold">
                        @stitches/react
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </section>

          {/* Dialog, Sheet, Drawer Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Overlays</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Open Dialog</Button>
                    </DialogTrigger>
                    <DialogContent className="border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A] bg-[#FFFDF7]">
                      <DialogHeader>
                        <DialogTitle className="font-bold text-[#1A1A1A]">Test Input</DialogTitle>
                        <DialogDescription className="font-bold text-[#6B6B6B]">
                          Enter some text below. Press Enter to submit (IME composition supported).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="dialog-input" className="font-bold text-[#1A1A1A]">Input</Label>
                          <Input
                            id="dialog-input"
                            placeholder="Type something..."
                            value={dialogInput}
                            onChange={(e) => setDialogInput(e.target.value)}
                            onKeyDown={handleDialogKeyDown}
                            autoFocus
                            className="border-2 border-[#1A1A1A] rounded-lg font-bold"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setDialogOpen(false)}
                          className="border-2 border-[#1A1A1A] rounded-lg font-bold"
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleDialogSubmit} className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">Submit</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Open Sheet</Button>
                    </SheetTrigger>
                    <SheetContent className="border-2 border-[#1A1A1A] bg-[#FFFDF7]">
                      <SheetHeader>
                        <SheetTitle className="font-bold text-[#1A1A1A]">Edit profile</SheetTitle>
                        <SheetDescription className="font-bold text-[#6B6B6B]">
                          Make changes to your profile here. Click save when
                          you're done.
                        </SheetDescription>
                      </SheetHeader>
                    </SheetContent>
                  </Sheet>

                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Open Drawer</Button>
                    </DrawerTrigger>
                    <DrawerContent className="border-2 border-[#1A1A1A] bg-[#FFFDF7]">
                      <DrawerHeader>
                        <DrawerTitle className="font-bold text-[#1A1A1A]">Are you absolutely sure?</DrawerTitle>
                        <DrawerDescription className="font-bold text-[#6B6B6B]">
                          This action cannot be undone.
                        </DrawerDescription>
                      </DrawerHeader>
                      <DrawerFooter>
                        <Button className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">Submit</Button>
                        <DrawerClose asChild>
                          <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg font-bold">Cancel</Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </DrawerContent>
                  </Drawer>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Open Popover</Button>
                    </PopoverTrigger>
                    <PopoverContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
                      <div className="space-y-2">
                        <h4 className="font-bold leading-none text-[#1A1A1A]">Dimensions</h4>
                        <p className="text-sm text-[#6B6B6B] font-bold">
                          Set the dimensions for the layer.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Hover me</Button>
                    </TooltipTrigger>
                    <TooltipContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
                      <p className="font-bold">Add to library</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Menus Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Menus</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Dropdown Menu</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
                      <DropdownMenuLabel className="font-bold text-[#1A1A1A]">My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-[#1A1A1A]" />
                      <DropdownMenuItem className="font-bold">Profile</DropdownMenuItem>
                      <DropdownMenuItem className="font-bold">Billing</DropdownMenuItem>
                      <DropdownMenuItem className="font-bold">Team</DropdownMenuItem>
                      <DropdownMenuItem className="font-bold">Subscription</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Right Click Me</Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
                      <ContextMenuItem className="font-bold">Profile</ContextMenuItem>
                      <ContextMenuItem className="font-bold">Billing</ContextMenuItem>
                      <ContextMenuItem className="font-bold">Team</ContextMenuItem>
                      <ContextMenuItem className="font-bold">Subscription</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="outline" className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">Hover Card</Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-[#1A1A1A]">@nextjs</h4>
                        <p className="text-sm font-bold text-[#6B6B6B]">
                          The React Framework – created and maintained by
                          @vercel.
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Calendar Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Calendar</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6 flex justify-center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-lg border-2 border-[#1A1A1A]"
                />
              </CardContent>
            </Card>
          </section>

          {/* Carousel Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Carousel</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <Carousel className="w-full max-w-xs mx-auto">
                  <CarouselContent>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                            <CardContent className="flex aspect-square items-center justify-center p-6">
                              <span className="text-4xl font-bold text-[#1A1A1A]">
                                {index + 1}
                              </span>
                            </CardContent>
                          </Card>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]" />
                  <CarouselNext className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]" />
                </Carousel>
              </CardContent>
            </Card>
          </section>

          {/* Toggle Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Toggle</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Toggle</Label>
                  <div className="flex gap-2">
                    <Toggle aria-label="Toggle italic" className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                      <span className="font-bold">B</span>
                    </Toggle>
                    <Toggle aria-label="Toggle italic" className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                      <span className="italic font-bold">I</span>
                    </Toggle>
                    <Toggle aria-label="Toggle underline" className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                      <span className="underline font-bold">U</span>
                    </Toggle>
                  </div>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Toggle Group</Label>
                  <ToggleGroup type="multiple">
                    <ToggleGroupItem value="bold" aria-label="Toggle bold" className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                      <span className="font-bold">B</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="italic" aria-label="Toggle italic" className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                      <span className="italic font-bold">I</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="underline"
                      aria-label="Toggle underline"
                      className="border-2 border-[#1A1A1A] rounded-lg font-bold"
                    >
                      <span className="underline font-bold">U</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Aspect Ratio & Scroll Area Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Layout Components</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Aspect Ratio (16/9)</Label>
                  <AspectRatio ratio={16 / 9} className="bg-[#A8E6CF] border-2 border-[#1A1A1A] rounded-lg">
                    <div className="flex h-full items-center justify-center">
                      <p className="text-[#1A1A1A] font-bold">16:9 Aspect Ratio</p>
                    </div>
                  </AspectRatio>
                </div>
                <Separator className="bg-[#1A1A1A] h-[2px]" />
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Scroll Area</Label>
                  <ScrollArea className="h-[200px] w-full rounded-lg border-2 border-[#1A1A1A] overflow-hidden">
                    <div className="p-4">
                      <div className="space-y-4">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={i} className="text-sm font-bold text-[#1A1A1A]">
                            Item {i + 1}: This is a scrollable content area
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Resizable Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Resizable Panels</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <ResizablePanelGroup
                  direction="horizontal"
                  className="min-h-[200px] rounded-lg border-2 border-[#1A1A1A]"
                >
                  <ResizablePanel defaultSize={50}>
                    <div className="flex h-full items-center justify-center p-6">
                      <span className="font-bold text-[#1A1A1A]">Panel One</span>
                    </div>
                  </ResizablePanel>
                  <ResizableHandle className="bg-[#1A1A1A] w-[2px]" />
                  <ResizablePanel defaultSize={50}>
                    <div className="flex h-full items-center justify-center p-6">
                      <span className="font-bold text-[#1A1A1A]">Panel Two</span>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </CardContent>
            </Card>
          </section>

          {/* Toast Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">Toast</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">Sonner Toast</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        sonnerToast.success("Operation successful", {
                          description: "Your changes have been saved",
                        });
                      }}
                      className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                    >
                      Success
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        sonnerToast.error("Operation failed", {
                          description:
                            "Cannot complete operation, please try again",
                        });
                      }}
                      className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                    >
                      Error
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        sonnerToast.info("Information", {
                          description: "This is an information message",
                        });
                      }}
                      className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                    >
                      Info
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        sonnerToast.warning("Warning", {
                          description:
                            "Please note the impact of this operation",
                        });
                      }}
                      className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                    >
                      Warning
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        sonnerToast.loading("Loading", {
                          description: "Please wait",
                        });
                      }}
                      className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                    >
                      Loading
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const promise = new Promise(resolve =>
                          setTimeout(resolve, 2000)
                        );
                        sonnerToast.promise(promise, {
                          loading: "Processing...",
                          success: "Processing complete!",
                          error: "Processing failed",
                        });
                      }}
                      className="border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                    >
                      Promise
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* AI ChatBox Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-[#1A1A1A]">AI ChatBox</h3>
            <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-sm text-[#6B6B6B] font-bold">
                    <p>
                      A ready-to-use chat interface component that integrates with the LLM system.
                      Features markdown rendering, auto-scrolling, and loading states.
                    </p>
                    <p className="mt-2">
                      This is a demo with simulated responses. In a real app, you'd connect it to a tRPC mutation.
                    </p>
                  </div>
                  <AIChatBox
                    messages={chatMessages}
                    onSendMessage={handleChatSend}
                    isLoading={isChatLoading}
                    placeholder="Try sending a message..."
                    height="500px"
                    emptyStateMessage="How can I help you today?"
                    suggestedPrompts={[
                      "What is React?",
                      "Explain TypeScript",
                      "How to use tRPC?",
                      "Best practices for web development",
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t-2 border-[#1A1A1A] py-6 mt-12">
        <div className="container text-center text-sm text-[#6B6B6B] font-bold">
          <p>Shadcn/ui Component Showcase</p>
        </div>
      </footer>
    </div>
  );
}
