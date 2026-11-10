package com.springboot.fasearch.modules.returns;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ReturnMathTest {
 @Test void splitAmountsAndPointsTelescope() {
  for (int total=0;total<150;total++) for(int qty=1;qty<20;qty++) {
   BigDecimal sum=BigDecimal.ZERO;int pts=0;
   for(int i=0;i<qty;i++){sum=sum.add(ReturnMath.share(BigDecimal.valueOf(total),i,1,qty));pts+=ReturnMath.points(17,BigDecimal.valueOf(i),BigDecimal.ONE,BigDecimal.valueOf(qty));}
   assertThat(sum).isEqualByComparingTo(BigDecimal.valueOf(total));assertThat(pts).isEqualTo(17);
  }
 }
 @Test void fractionalManualMoneyIsNotLost() {
  BigDecimal total=new BigDecimal("100.51");BigDecimal sum=BigDecimal.ZERO;
  for(int i=0;i<3;i++)sum=sum.add(ReturnMath.share(total,i,1,3));
  assertThat(sum).isEqualByComparingTo(total);
 }
 @Test void rejectsOverQuantityAndNegative() {
  assertThatThrownBy(()->ReturnMath.share(BigDecimal.TEN,2,2,3)).isInstanceOf(IllegalArgumentException.class);
  assertThatThrownBy(()->ReturnMath.share(BigDecimal.TEN,-1,1,3)).isInstanceOf(IllegalArgumentException.class);
 }
}
