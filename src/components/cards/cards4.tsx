import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
import { TrendingUpIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const Card4 = () => {
    return(
        <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Margen de crecimiento</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            4.5%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +2.5%/12M
            </Badge>
          </div>
        </CardHeader> 
        <CardFooter className="flex-col items-start gap-1 text-sm">
          {/* <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance <TrendingUpIcon className="size-4" />
          </div> */}
          <div className="text-muted-foreground">Margen de crecimiento para los ultimos 6 meses</div>
        </CardFooter>
      </Card>
    )   
}
export default Card4